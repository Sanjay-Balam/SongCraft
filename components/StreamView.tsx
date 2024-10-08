"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Share2, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Appbar } from "./Appbar";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { YT_REGEX } from "../lib/utils";
import YouTubePlayer from "youtube-player";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Video {
  id: string;
  type: string;
  url: string;
  extractedId: string;
  title: string;
  smallImg: string;
  bigImg: string;
  active: boolean;
  userId: string;
  upvotes: number;
  haveUpvoted: boolean;
}

interface CustomSession extends Omit<Session, "user"> {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const REFRESH_INTERVAL_MS = 10 * 1000;

export default function StreamView({
  creatorId,
  playVideo = false,
}: {
  creatorId: string;
  playVideo: boolean;
}) {
  const [inputLink, setInputLink] = useState("");
  const [queue, setQueue] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [playNextLoader, setPlayNextLoader] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession() as { data: CustomSession | null };
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isEmptyQueueDialogOpen, setIsEmptyQueueDialogOpen] = useState(false);

  async function refreshStreams() {
    try {
      const res = await fetch(`/api/streams/?creatorId=${creatorId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.streams && Array.isArray(json.streams)) {
        setQueue(
          json.streams.length > 0
            ? json.streams.sort((a: Video, b: Video) => b.upvotes - a.upvotes)
            : [],
        );
      } else {
        setQueue([]);
      }

      setCurrentVideo((video) => {
        if (video?.id === json.activeStream?.stream?.id) {
          return video;
        }
        return json.activeStream?.stream || null;
      });

      setCreatorUserId(json.creatorUserId);
      setIsCreator(json.isCreator);
      console.log(creatorUserId);
    } catch (error) {
      console.error("Error refreshing streams:", error);
      setQueue([]);
      setCurrentVideo(null);
    }
  }

  useEffect(() => {
    refreshStreams();
    const interval = setInterval(refreshStreams, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [creatorId]);

  useEffect(() => {
    if (!videoPlayerRef.current || !currentVideo) return;

    const player = YouTubePlayer(videoPlayerRef.current);
    player.loadVideoById(currentVideo.extractedId);
    player.playVideo();

    const eventHandler = (event: { data: number }) => {
      if (event.data === 0) {
        playNext();
      }
    };
    player.on("stateChange", eventHandler);

    return () => {
      player.destroy();
    };
  }, [currentVideo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLink.trim()) {
      toast.error("YouTube link cannot be empty");
      return;
    }
    if (!YT_REGEX.test(inputLink)) {
      toast.error("Invalid YouTube URL format");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/streams/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creatorId,
          url: inputLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "An error occurred");
      }
      setQueue((prevQueue) => [...prevQueue, data]);
      setInputLink("");
      toast.success("Song added to queue successfully");
    } catch (error) {
      toast.error((error as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (id: string, isUpvote: boolean) => {
    setQueue((prevQueue) =>
      prevQueue
        .map((video) =>
          video.id === id
            ? {
                ...video,
                upvotes: isUpvote ? video.upvotes + 1 : video.upvotes - 1,
                haveUpvoted: !video.haveUpvoted,
              }
            : video,
        )
        .sort((a, b) => b.upvotes - a.upvotes),
    );

    fetch(`/api/streams/${isUpvote ? "upvote" : "downvote"}`, {
      method: "POST",
      body: JSON.stringify({ streamId: id }),
      headers: {
        "Content-Type": "application/json",
      },
    }).catch((error) => console.error("Vote error:", error));
  };

  const playNext = async () => {
    if (queue.length > 0) {
      try {
        setPlayNextLoader(true);
        const response = await fetch("/api/streams/next");
        const json = await response.json();
        if (response.ok) {
          setCurrentVideo(json.stream);
          setQueue((prevQueue) => prevQueue.filter((x) => x.id !== json.stream?.id));
        } else {
          toast.error("Failed to play next song");
        }
      } catch (e) {
        console.error("Error playing next song:", e);
      } finally {
        setPlayNextLoader(false);
      }
    }
  };

  const handleShare = () => {
    const shareableLink = `${window.location.origin}/creator/${creatorId}`;
    navigator.clipboard.writeText(shareableLink).then(
      () => {
        toast.success("Link copied to clipboard!");
      },
      (err) => {
        console.error("Could not copy text:", err);
        toast.error("Failed to copy link. Please try again.");
      },
    );
  };

  const emptyQueue = async () => {
    try {
      const res = await fetch("/api/streams/empty-queue", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        refreshStreams();
        setIsEmptyQueueDialogOpen(false);
      } else {
        toast.error(data.message || "Failed to empty queue");
      }
    } catch (error) {
      console.error("Error emptying queue:", error);
      toast.error("An error occurred while emptying the queue");
    }
  };

  const removeSong = async (streamId: string) => {
    try {
      const res = await fetch(`/api/streams/remove?streamId=${streamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Song removed successfully");
        refreshStreams();
      } else {
        toast.error("Failed to remove song");
      }
    } catch (error) {
      toast.error("An error occurred while removing the song");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-black text-gray-200">
      <Appbar />
      <div className="flex justify-center px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 w-full max-w-7xl">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <h2 className="text-3xl font-bold text-white">Upcoming Songs</h2>
              <div className="flex space-x-2">
                <Button
                  onClick={handleShare}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  <Share2 className="mr-2 h-4 w-4" /> Share
                </Button>
                {isCreator && (
                  <Button
                    onClick={() => setIsEmptyQueueDialogOpen(true)}
                    className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Empty Queue
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {queue.map((video) => (
                <Card key={video.id} className="bg-gray-800 border border-gray-700">
                  <CardContent className="flex flex-col">
                    <LiteYouTubeEmbed id={video.extractedId} title={video.title} />
                    <div className="flex justify-between mt-4">
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleVote(video.id, true)}
                          disabled={video.haveUpvoted}
                          className="bg-green-600 hover:bg-green-700 text-white transition-colors"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <span>{video.upvotes}</span>
                        <Button
                          onClick={() => handleVote(video.id, false)}
                          disabled={!video.haveUpvoted}
                          className="bg-red-600 hover:bg-red-700 text-white transition-colors"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {isCreator && (
                        <Button
                          onClick={() => removeSong(video.id)}
                          className="bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <h2 className="text-3xl font-bold mb-4">Now Playing</h2>
            {currentVideo ? (
              <Card className="bg-gray-800 border border-gray-700">
                <CardContent className="flex flex-col">
                  <LiteYouTubeEmbed id={currentVideo.extractedId} title={currentVideo.title} />
                  <h3 className="mt-2 text-lg font-semibold">{currentVideo.title}</h3>
                </CardContent>
              </Card>
            ) : (
              <div className="text-gray-400">No video currently playing</div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog for emptying queue confirmation */}
      <Dialog open={isEmptyQueueDialogOpen} onOpenChange={setIsEmptyQueueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Empty Queue</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to empty the entire queue?</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsEmptyQueueDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-500" onClick={emptyQueue}>
              Empty Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={inputLink}
            onChange={(e) => setInputLink(e.target.value)}
            placeholder="Paste YouTube link here..."
            className="flex-1"
            required
          />
          <Button type="submit" className="bg-blue-500 hover:bg-blue-600" disabled={loading}>
            {loading ? "Loading..." : "Add Song"}
          </Button>
        </form>
      </div>
    </div>
  );
}

import {z} from "zod"
import db from "@/lib/db"

// @ts-expect-error: The 'youtube-search-api' package does not have TypeScript definitions.
import youtubesearchapi from "youtube-search-api";
import { YT_REGEX } from "@/lib/utils";
import { authOptions } from "@/lib/auth-options";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

const CreateStreamSchema = z.object({
    creatorId: z.string(),
    url: z.string()
});

const MAX_QUEUE_LEN = 20;

export async function POST(req:NextRequest){
    try{
        const session = await getServerSession(authOptions);

        if (!session?.user.id) {
            return NextResponse.json(
            {
            message: "Unauthenticated",
            },
            {
            status: 403,
            },
        );
        }
        const user = session.user;

        const data = CreateStreamSchema.parse(await req.json());

        if (!data.url.trim()) {
        return NextResponse.json(
            {
            message: "YouTube link cannot be empty",
            },
            {
            status: 400,
            },
        );
        }

        const isYt = data.url.match(YT_REGEX);
        if (!isYt) {
        return NextResponse.json(
            {
            message: "Invalid YouTube URL format",
            },
            {
            status: 400,
            },
        );
        }

        const extractedId = data.url.split("?v=")[1];
        const res = await youtubesearchapi.GetVideoDetails(extractedId);
        
        if(user.id !== data.creatorId){
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

            const userRecentStreams = await db.stream.count({
                where:{
                    userId:data.creatorId,
                    addedBy: user.id,
                    createAt:{
                        gte: tenMinutesAgo
                    },
                },
            });


            // Checking for the Duplicate songs 
            const duplicateSong = await db.stream.findFirst({
                where:{
                    userId: data.creatorId,
                    extractedId: extractedId,
                    createAt:{
                        gte: tenMinutesAgo,
                    },
                },
            });

            if(duplicateSong){
                return NextResponse.json({
                    message: "This song was already added in the last 10 min",
                },{
                    status:429,
                },
                );
            }

            // Rate limit checks for non-creator users
            const streamsLastTwoMinutes = await db.stream.count({
                where:{
                    userId:data.creatorId,
                    addedBy:user.id,
                    createAt:{
                        gte:twoMinutesAgo
                    },
                },
            });

            if (streamsLastTwoMinutes >= 2) {
                return NextResponse.json(
                  {
                    message:
                      "Rate limit exceeded: You can only add 2 songs per 2 minutes",
                  },
                  {
                    status: 429,
                  },
                );
            }
            
            if (userRecentStreams >= 5) {
                return NextResponse.json(
                  {
                    message:
                      "Rate limit exceeded: You can only add 5 songs per 10 minutes",
                  },
                  {
                    status: 429,
                  },
                );
            }
        }

        const thumbnails = res.thumbnail.thumbnails;
        thumbnails.sort((a: { width: number }, b: { width: number }) =>
            a.width < b.width ? -1 : 1,
        );

        const existingActiveStreams = await db.stream.count({
            where:{
                userId: data.creatorId,
                played: false
            },
        });

        if (existingActiveStreams >= MAX_QUEUE_LEN) {
            return NextResponse.json(
              {
                message: "Queue is full",
              },
              {
                status: 429,
              },
            );
        }

        const stream = await db.stream.create({
            data: {
              userId: data.creatorId,
              addedBy: user.id,
              url: data.url,
              extractedId,
              type: "Youtube",
              title: res.title ?? "Can't find video",
              smallImg:
                (thumbnails.length > 1
                  ? thumbnails[thumbnails.length - 2].url
                  : thumbnails[thumbnails.length - 1].url) ??
                "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
              bigImg:
                thumbnails[thumbnails.length - 1].url ??
                "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
            },
        });
        return NextResponse.json({
            ...stream,
            hasUpvoted: false,
            upvotes: 0,
        });
    }
    catch(e){
        console.log(e);
        return NextResponse.json({
            message: "Error while adding a stream",
        },
        {
            status:500
        })
    }
}



export async function GET(req:NextRequest){
    const creatorId = req.nextUrl.searchParams.get("creatorId");
    const session = await getServerSession(authOptions);

    if(!session?.user.id){
        return NextResponse.json({
            message:"Unauthenticated"
        },
        {
            status:403
        },);
    }

    const user = session.user;

    if(!creatorId){
        return NextResponse.json({
            message : "Error",
        },{
            status:411,
        },);
    }

    const [streams, activeStream] = await Promise.all([
        db.stream.findMany({
          where: {
            userId: creatorId,
            played: false,
          },
          include: {
            _count: {
              select: {
                upvotes: true,
              },
            },
            upvotes: {
              where: {
                userId: user.id,
              },
            },
          },
        }),
        db.currentStream.findFirst({
          where: {
            userId: creatorId,
          },
          include: {
            stream: true,
          },
        }),
    ]);

    const isCreator = user.id === creatorId;

    return NextResponse.json({
        streams: streams.map(({_count, ...rest}) => ({
            ...rest,
            upvotes: _count.upvotes,
            haveUpvoted: rest.upvotes.length ? true : false,
        })),
        activeStream,
        creatorId,
        isCreator
    })
}
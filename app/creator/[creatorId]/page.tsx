import StreamView from "@/components/StreamView";
import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";


export default async function Creator({
    params: { creatorId },
  }: {
    params: {
      creatorId: string;
    };
  }){
    const session = await getServerSession(authOptions);
    if (!session?.user.id) redirect("/");
    return (
        <div>
          <StreamView creatorId={creatorId} playVideo={false} />
        </div>
    );
}
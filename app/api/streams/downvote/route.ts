import db from "@/lib/db"
import { authOptions } from "@/lib/auth-options"
import {z} from "zod"
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

const DownVoteSchema = z.object({
    streamId: z.string()
});


export async function POST(req:NextRequest){
    const session = await getServerSession(authOptions);

    if(!session?.user.id){
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
    try{
        const data = DownVoteSchema.parse(await req.json());
        await db.upvote.delete({
            where:{
                userId_streamId:{
                    userId:user.id,
                    streamId:data.streamId,
                },
            },
        });
        
        return NextResponse.json({
            message : "Done!",
        });
        
    }catch(e){
        console.log(e);
        return NextResponse.json(
            {
              message: "Error while upvoting",
            },
            {
              status: 403,
            },
        );
    }
}
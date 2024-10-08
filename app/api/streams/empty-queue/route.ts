import { authOptions } from "@/lib/auth-options";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import {NextResponse } from "next/server";

export async function POST(){
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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
        await db.stream.updateMany({
            where:{
                userId : user.id,
                played : false
            },
            data:{
                played : true,
                playedTs : new Date()
            },
        });

        return NextResponse.json({
            message : "Queue Emptied successfully!",
        });

    }catch(e){
        console.error("Error emptying queue:", e);
        return NextResponse.json(
        {
            message: "Error while emptying the queue",
        },
        {
            status: 500,
        },
        );
    }
}
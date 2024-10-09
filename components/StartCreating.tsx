"use client"

import {Button} from "@/components/ui/button"
import { signIn, useSession } from "next-auth/react"


export function StartCreating(){
    const session = useSession();

    return (
        <div>

            {!session.data?.user && (
                <Button
                className="bg-purple-600 text-white hover:bg-purple-700"
                onClick={()=>signIn()}
                >
                    Start Creating
                </Button>
            )}
        </div>
    )
}
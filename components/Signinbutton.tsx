"use client"

import {Button} from "@/components/ui/button"
import { signIn, signOut, useSession } from "next-auth/react"


export function Signinbutton(){
    const session = useSession();

    return (
        <div>
            {session.data?.user && (
                <Button 
                className="bg-purple-600 text-white hover:bg-purple-700"
                onClick={()=>signOut()}
                >
                Logout
                </Button>
            )}

            {!session.data?.user && (
                <Button
                className="bg-purple-600 text-white hover:bg-purple-700"
                onClick={()=>signIn()}
                >
                    Signin
                </Button>
            )}
        </div>
    )
}
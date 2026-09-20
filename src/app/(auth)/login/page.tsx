import { SignIn } from "@/components/auth/sign-in";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage(){
    const session = await auth();
    if (session) {
        redirect("/home");
    }
  
    return <SignIn/>
}
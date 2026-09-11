import { redirect } from "next/navigation";

/** The short URL on the slide points here. */
export default function Home() {
  redirect("/board");
}

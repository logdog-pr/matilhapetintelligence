import { NextResponse, type NextRequest } from "next/server";
import { configStatus } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (configStatus().auth) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

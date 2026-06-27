import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId, stakeAmount, gameId } = body;

    // 1. Frontend'den gelen Authorization header'ını yakala
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Supabase istemcisini Privy token'ı ile başlat
    const supabase = getSupabaseClient(token);

    // 3. Supabase'in bu token'ı doğrulamasını ve kullanıcıyı bulmasını bekle
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }

    // 4. Kullanıcı doğrulandığına göre güvenle veritabanına yaz
    // (RLS politikası zaten auth.uid() == player_a_id kontrolünü yapacak)
    const { data, error } = await supabase
      .from("matches")
      .insert({
        smart_contract_match_id: matchId,
        stake_amount: stakeAmount,
        game_id: gameId,
        player_a_id: user.id, 
        status: "searching"
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
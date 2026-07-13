import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import db from "@/lib/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // idが数値の場合はメンバーのmember_id文字列を取得してから検索
    const isNumericId = /^\d+$/.test(id);
    
    let memberIdStr: string | null = null;
    
    if (isNumericId) {
      // 整数IDからメンバーのmember_id文字列を取得
      const member = db.prepare(`
        SELECT member_id FROM members WHERE id = ?
      `).get(parseInt(id)) as { member_id: string } | undefined;
      
      if (member) {
        memberIdStr = member.member_id;
      }
    } else {
      // 直接member_id文字列として使用
      memberIdStr = id;
    }

    if (!memberIdStr) {
      return NextResponse.json({
        success: true,
        history: [],
      });
    }

    // member_id_strで検索
    const stmt = db.prepare(`
      SELECT
        id,
        member_id,
        member_id_str,
        affiliation,
        check_in_time,
        check_out_time
      FROM checkins
      WHERE member_id_str = ?
      ORDER BY check_in_time DESC
      LIMIT ? OFFSET ?
    `);
    const history = stmt.all(memberIdStr, limit, offset);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Error fetching check-in history:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

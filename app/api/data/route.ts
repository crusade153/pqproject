import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export interface CostRow {
  factory: string;
  code: string;
  name: string;
  team: string;
  category: string;
  
  // ⭐ 추가된 요약 정보
  dateRange: string;  // 예: "1/2 ~ 1/5"
  orderCount: number; // 예: 5 (5건의 오더 합산)
  
  // 수치 데이터
  q: number;
  mat_raw: number;
  mat_sub: number;
  mat_pack: number;
  mat_self: number;
  mat_total: number;
  depreciation: number;
  labor_direct: number;
  labor_indirect: number;
  utility: number;
  etc: number;
  process_total: number;
  total_cost: number;
}

export const revalidate = 0;

export async function GET() {
  try {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
      throw new Error('구글 인증 정보가 없습니다.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const ranges = ['K1!A2:S', 'K2!A2:S', 'K3!A2:S']; // S열까지 조회
    
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges: ranges,
    });

    const valueRanges = response.data.valueRanges;
    
    // 집계용 객체 (타입 확장)
    const aggregatedData: Record<string, CostRow & { dates: Set<string> }> = {};

    if (valueRanges) {
      valueRanges.forEach((range) => {
        const rows = range.values;
        let rawSheetName = range.range?.split('!')[0] || 'Unknown';
        const cleanFactoryName = rawSheetName.replace(/['"\s]/g, '');

        if (rows && rows.length > 0) {
          rows.forEach((row) => {
            const code = row[0] || 'CodeN/A';
            const uniqueKey = `${cleanFactoryName}_${code}`;
            const dateStr = row[3] || ''; // D열: 실적일

            const parseNum = (idx: number) => {
              const val = row[idx];
              if (!val) return 0;
              const num = Number(val.replace(/,/g, ''));
              return isNaN(num) ? 0 : num;
            };

            if (!aggregatedData[uniqueKey]) {
              aggregatedData[uniqueKey] = {
                factory: cleanFactoryName,
                code: code,
                name: row[1] || '',
                team: row[5] || '',
                category: row[6] || '',
                
                // 날짜/오더 집계 초기화
                dateRange: '', 
                dates: new Set([dateStr]), // 날짜 모으기
                orderCount: 1,             // 오더 카운트 시작

                q: parseNum(2),
                mat_raw: parseNum(7),
                mat_sub: parseNum(8),
                mat_pack: parseNum(9),
                mat_self: parseNum(10),
                mat_total: parseNum(11),
                depreciation: parseNum(12),
                labor_direct: parseNum(13),
                labor_indirect: parseNum(14),
                utility: parseNum(15),
                etc: parseNum(16),
                process_total: parseNum(17),
                total_cost: parseNum(18),
              };
            } else {
              const target = aggregatedData[uniqueKey];
              if (dateStr) target.dates.add(dateStr); // 날짜 추가
              target.orderCount += 1;                 // 오더 건수 증가

              target.q += parseNum(2);
              target.mat_raw += parseNum(7);
              target.mat_sub += parseNum(8);
              target.mat_pack += parseNum(9);
              target.mat_self += parseNum(10);
              target.mat_total += parseNum(11);
              target.depreciation += parseNum(12);
              target.labor_direct += parseNum(13);
              target.labor_indirect += parseNum(14);
              target.utility += parseNum(15);
              target.etc += parseNum(16);
              target.process_total += parseNum(17);
              target.total_cost += parseNum(18);
            }
          });
        }
      });
    }

    // 결과 변환 시 날짜 범위 문자열 생성
    const resultRows = Object.values(aggregatedData).map(item => {
      // 날짜 정렬 후 범위 표시 (예: "1/2" 또는 "1/2~1/5")
      const sortedDates = Array.from(item.dates).sort();
      let dateDisplay = '-';
      if (sortedDates.length === 1) dateDisplay = sortedDates[0];
      else if (sortedDates.length > 1) dateDisplay = `${sortedDates[0]}~${sortedDates[sortedDates.length - 1]}`;

      // dates Set은 JSON 변환 안 되므로 제거하고 dateRange 할당
      const { dates, ...rest } = item;
      return { ...rest, dateRange: dateDisplay };
    });

    return NextResponse.json({ 
      message: '성공',
      count: resultRows.length,
      data: resultRows 
    });

  } catch (error: any) {
    console.error('Data Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
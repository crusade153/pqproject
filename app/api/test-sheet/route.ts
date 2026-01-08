// app/api/data/route.ts
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// 1. 요청하신 19개 컬럼에 맞춘 데이터 타입 정의
export interface CostRow {
  // 기준 정보 (Key)
  month: string;      // 월 (1월, 2월...)
  factory: string;    // 공장 (K1...)
  code: string;       // 제품코드
  
  // 텍스트 정보 (대표값)
  name: string;       // 제품명
  team: string;       // 팀
  category: string;   // 카테고리
  
  // 합산할 수치 데이터 (12개 항목)
  q: number;              // 생산실적
  mat_raw: number;        // 원자재
  mat_sub: number;        // 부자재
  mat_pack: number;       // 포장재
  mat_self: number;       // 자소소재
  mat_total: number;      // 재료비합계
  depreciation: number;   // 감가상각비
  labor_direct: number;   // 직접노무비
  labor_indirect: number; // 간접노무비
  utility: number;        // 유틸리티
  etc: number;            // 기타경비
  process_total: number;  // 가공비합계
  total_cost: number;     // 제조원가
}

export const revalidate = 0; // 항상 최신 데이터 조회

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

    // A열(제품코드) ~ S열(제조원가)까지 조회
    const ranges = ['K1!A2:S', 'K2!A2:S', 'K3!A2:S'];
    
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges: ranges,
    });

    const valueRanges = response.data.valueRanges;
    
    // ⭐ 데이터 집계용 객체 (Map)
    // Key: "공장_월_제품코드" 형태로 만들어서 중복을 찾습니다.
    const aggregatedData: Record<string, CostRow> = {};

    if (valueRanges) {
      valueRanges.forEach((range) => {
        const rows = range.values;
        const sheetName = range.range?.split('!')[0] || 'Unknown'; 

        if (rows) {
          rows.forEach((row) => {
            // 1. 날짜 변환 (1/2 -> 1월)
            const dateStr = row[3] || ''; // D열: 실적일
            let month = '미상';
            if (dateStr.includes('/')) {
              month = `${dateStr.split('/')[0]}월`;
            }

            const code = row[0] || 'CodeN/A'; // A열: 제품코드
            
            // 2. 고유 키 생성 (공장 + 월 + 제품코드)
            const uniqueKey = `${sheetName}_${month}_${code}`;

            // 3. 숫자 변환 헬퍼 (콤마 제거)
            const parseNum = (idx: number) => Number(row[idx]?.replace(/,/g, '') || 0);

            // 4. 데이터 합산 로직
            if (!aggregatedData[uniqueKey]) {
              // (1) 처음 발견된 제품이면 -> 새로 만듦
              aggregatedData[uniqueKey] = {
                factory: sheetName,
                month: month,
                code: code,
                name: row[1] || '',           // B열: 제품명
                // 오더번호(4)는 합산 시 의미가 모호하여 제외하거나 필요시 첫번째 값 사용
                team: row[5] || '',           // F열: 팀
                category: row[6] || '',       // G열: 카테고리
                
                // 수치 초기화
                q: parseNum(2),               // C열: 생산실적
                mat_raw: parseNum(7),         // H열: 원자재
                mat_sub: parseNum(8),         // I열: 부자재
                mat_pack: parseNum(9),        // J열: 포장재
                mat_self: parseNum(10),       // K열: 자소소재
                mat_total: parseNum(11),      // L열: 재료비합계
                depreciation: parseNum(12),   // M열: 감가상각비
                labor_direct: parseNum(13),   // N열: 직접노무비
                labor_indirect: parseNum(14), // O열: 간접노무비
                utility: parseNum(15),        // P열: 유틸리티
                etc: parseNum(16),            // Q열: 기타경비
                process_total: parseNum(17),  // R열: 가공비합계
                total_cost: parseNum(18),     // S열: 제조원가
              };
            } else {
              // (2) 이미 있는 제품이면 -> 수치만 계속 더함 (Accumulate)
              const target = aggregatedData[uniqueKey];
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

    // 객체를 배열로 변환하여 리턴
    const resultRows = Object.values(aggregatedData);

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
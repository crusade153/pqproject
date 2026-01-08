import * as XLSX from "xlsx";
import { CostData } from "@/types";

export const downloadCostDataExcel = (data: CostData[]) => {
  const fileName = `제조원가_상세분석_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // 1. 합계(Total) 계산
  const total = data.reduce(
    (acc, curr) => {
      // "96건 합산" -> 96 숫자 추출
      const currentOrderCount = Number(String(curr.order_count).replace(/[^0-9]/g, ""));
      
      return {
        production_q: acc.production_q + curr.production_q,
        order_count: acc.order_count + currentOrderCount,
        raw_material: acc.raw_material + curr.raw_material,
        sub_material: acc.sub_material + curr.sub_material,
        packaging: acc.packaging + curr.packaging,
        consumable: acc.consumable + curr.consumable,
        material_total: acc.material_total + curr.material_total,
        depreciation: acc.depreciation + curr.depreciation,
        direct_labor: acc.direct_labor + curr.direct_labor,
        indirect_labor: acc.indirect_labor + curr.indirect_labor,
        utility: acc.utility + curr.utility,
        other_expense: acc.other_expense + curr.other_expense,
        processing_total: acc.processing_total + curr.processing_total,
        total_cost: acc.total_cost + curr.total_cost,
      };
    },
    {
      production_q: 0, order_count: 0, raw_material: 0, sub_material: 0, packaging: 0,
      consumable: 0, material_total: 0, depreciation: 0, direct_labor: 0, indirect_labor: 0,
      utility: 0, other_expense: 0, processing_total: 0, total_cost: 0,
    }
  );

  // 2. 헤더 정의 (누적비중, 실적일 제거됨)
  // 총 19개 컬럼
  const headers = [
    "순위", "제품코드", "제품명", "생산실적", "총 생산횟수", "팀", "카테고리",
    "원자재", "부자재", "포장재", "자소소재", "재료비합계",
    "감가상각비", "직접노무비", "간접노무비", "유틸리티", "기타경비", "가공비합계", "제조원가"
  ];

  // 3. 데이터 매핑 (순서 엄수)
  const rows = data.map((item, index) => [
    index + 1,                                            // 1. 순위
    item.product_code,                                    // 2. 제품코드
    item.product_name,                                    // 3. 제품명
    item.production_q,                                    // 4. 생산실적
    `${String(item.order_count).replace(/[^0-9]/g, "")}회`, // 5. 총 생산횟수 (포맷 변경)
    item.team,                                            // 6. 팀
    item.category,                                        // 7. 카테고리
    item.raw_material,                                    // 8. 원자재
    item.sub_material,                                    // 9. 부자재
    item.packaging,                                       // 10. 포장재
    item.consumable,                                      // 11. 자소소재
    item.material_total,                                  // 12. 재료비합계
    item.depreciation,                                    // 13. 감가상각비
    item.direct_labor,                                    // 14. 직접노무비
    item.indirect_labor,                                  // 15. 간접노무비
    item.utility,                                         // 16. 유틸리티
    item.other_expense,                                   // 17. 기타경비
    item.processing_total,                                // 18. 가공비합계
    item.total_cost,                                      // 19. 제조원가
  ]);

  // 4. 합계 행(Footer) 생성 - ★ 정렬 핵심 수정 ★
  // 헤더 개수(19개)와 정확히 일치해야 밀리지 않습니다.
  const footerRow = [
    "",                     // 1. 순위 (빈칸)
    "",                     // 2. 제품코드 (빈칸)
    "TOTAL",                // 3. 제품명 자리에 'TOTAL'
    total.production_q,     // 4. 생산실적 합계
    `${total.order_count}회`, // 5. 총 생산횟수 합계
    "",                     // 6. 팀 (빈칸)
    "",                     // 7. 카테고리 (빈칸)
    total.raw_material,     // 8. 원자재 합계
    total.sub_material,     // 9. 부자재 합계
    total.packaging,        // 10. 포장재 합계
    total.consumable,       // 11. 자소소재 합계
    total.material_total,   // 12. 재료비 합계
    total.depreciation,     // 13. 감가상각비 합계
    total.direct_labor,     // 14. 직접노무비 합계
    total.indirect_labor,   // 15. 간접노무비 합계
    total.utility,          // 16. 유틸리티 합계
    total.other_expense,    // 17. 기타경비 합계
    total.processing_total, // 18. 가공비 합계
    total.total_cost,       // 19. 제조원가 합계
  ];

  // 5. 시트 생성
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows, footerRow]);

  // 6. 컬럼 너비 설정 (보기 좋게 조정)
  worksheet["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "원가분석");
  XLSX.writeFile(workbook, fileName);
};
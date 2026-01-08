// types/index.ts

export type CostData = {
  id: string | number;    // No.
  product_code: string;   // 제품코드
  product_name: string;   // 제품명
  production_q: number;   // 생산실적
  order_count: string | number; // 총 생산횟수 (DB 원본: "96건 합산" or 96)
  team: string;           // 팀
  category: string;       // 카테고리
  
  // --- 상세 원가 항목 ---
  raw_material: number;   // 원자재
  sub_material: number;   // 부자재
  packaging: number;      // 포장재
  consumable: number;     // 자소소재
  material_total: number; // 재료비합계
  
  depreciation: number;   // 감가상각비
  direct_labor: number;   // 직접노무비
  indirect_labor: number; // 간접노무비
  utility: number;        // 유틸리티
  other_expense: number;  // 기타경비
  processing_total: number;// 가공비합계
  
  total_cost: number;     // 제조원가
};
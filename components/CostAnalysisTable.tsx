"use client";

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { Download } from "lucide-react";
import { CostData } from "@/types";
import { downloadCostDataExcel } from "@/lib/excel";

// 숫자 포맷터 (세자리 콤마)
const formatNumber = (num: unknown) => {
  if (typeof num !== "number") return "-";
  return new Intl.NumberFormat("ko-KR").format(num);
};

interface Props {
  data: CostData[];
}

export default function CostAnalysisTable({ data }: Props) {
  
  const columns = useMemo<ColumnDef<CostData>[]>(
    () => [
      {
        accessorKey: "id",
        header: "순위",
        cell: (info) => info.row.index + 1,
        footer: "", // 빈칸
      },
      {
        accessorKey: "product_code",
        header: "제품코드",
        footer: "", // 빈칸
      },
      {
        accessorKey: "product_name",
        header: "제품명",
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue() as string}</span>,
        footer: "TOTAL", // ★ TOTAL 라벨
      },
      {
        accessorKey: "production_q",
        header: "생산실적",
        cell: (info) => formatNumber(info.getValue()),
        footer: ({ table }) => { // 합계 계산
            const total = table.getFilteredRowModel().rows.reduce((sum, row) => sum + row.original.production_q, 0);
            return formatNumber(total);
        }
      },
      {
        accessorKey: "order_count",
        header: "총 생산횟수", // ★ 명칭 변경
        cell: (info) => {
          const val = String(info.getValue());
          const count = val.replace(/[^0-9]/g, ""); 
          return <span className="text-center block">{count}회</span>; // ★ 포맷 변경
        },
        footer: ({ table }) => { // 횟수 합계
            const total = table.getFilteredRowModel().rows.reduce((sum, row) => {
                 return sum + Number(String(row.original.order_count).replace(/[^0-9]/g, ""));
            }, 0);
            return `${total}회`;
        }
      },
      { accessorKey: "team", header: "팀", footer: "" }, // 합계 없음 (빈칸)
      { accessorKey: "category", header: "카테고리", footer: "" }, // 합계 없음 (빈칸)
      
      // --- 여기서부터 모든 원가 항목 합계 표시 ---
      { accessorKey: "raw_material", header: "원자재" },
      { accessorKey: "sub_material", header: "부자재" },
      { accessorKey: "packaging", header: "포장재" },
      { accessorKey: "consumable", header: "자소소재" },
      { 
        accessorKey: "material_total", 
        header: "재료비합계", 
        cell: (info) => <span className="font-bold text-blue-600">{formatNumber(info.getValue())}</span> 
      },
      
      { accessorKey: "depreciation", header: "감가상각비" },
      { accessorKey: "direct_labor", header: "직접노무비" },
      { accessorKey: "indirect_labor", header: "간접노무비" },
      { accessorKey: "utility", header: "유틸리티" },
      { accessorKey: "other_expense", header: "기타경비" },
      { 
        accessorKey: "processing_total", 
        header: "가공비합계",
        cell: (info) => <span className="font-bold text-green-600">{formatNumber(info.getValue())}</span>
      },
      
      {
        accessorKey: "total_cost",
        header: "제조원가",
        cell: (info) => <span className="font-bold text-red-600">{formatNumber(info.getValue())}</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">상세 원가 분석</h2>
        <button
          onClick={() => downloadCostDataExcel(data)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download size={16} />
          엑셀 다운로드
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-xs whitespace-nowrap">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 border-b border-gray-200 first:text-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 whitespace-nowrap transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2 first:text-center">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {/* Footer 정렬 수정 완료 */}
            <tfoot className="bg-gray-100 font-bold text-gray-900 whitespace-nowrap border-t-2 border-gray-300">
               {table.getFooterGroups().map(footerGroup => (
                  <tr key={footerGroup.id}>
                    {footerGroup.headers.map(header => (
                      <td key={header.id} className="px-4 py-3 bg-gray-100 first:text-center">
                         {/* 1. 명시적인 Footer 값이 있으면 출력 (TOTAL 등) */}
                         {header.column.columnDef.footer 
                           ? flexRender(header.column.columnDef.footer, header.getContext())
                           : (typeof header.column.columnDef.footer === 'string' ? header.column.columnDef.footer : "")
                         }
                         
                         {/* 2. 원가 항목 자동 합계 계산 */}
                         {!header.column.columnDef.footer && 
                          ["raw_material", "sub_material", "packaging", "consumable", "material_total", 
                           "depreciation", "direct_labor", "indirect_labor", "utility", "other_expense", 
                           "processing_total", "total_cost"].includes(header.column.id) 
                           && formatNumber(
                                table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.getValue(header.column.id) as number), 0)
                           )
                         }
                      </td>
                    ))}
                  </tr>
               ))}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
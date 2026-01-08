'use client';

import { useEffect, useState, useMemo } from 'react';

// 백엔드 데이터 타입
interface CostRow {
  factory: string;
  code: string;
  name: string;
  team: string;
  category: string;
  dateRange: string;  // (데이터에는 있지만 화면엔 표시 안 함)
  orderCount: number; 
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

interface ParetoRow extends CostRow {
  cumulativeQ: number;
  cumulativeRatio: number;
}

export default function Home() {
  const [data, setData] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedFactory, setSelectedFactory] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data');
        const text = await res.text();
        try {
          const result = JSON.parse(text);
          if (!res.ok) throw new Error(result.error);
          setData(Array.isArray(result.data) ? result.data : []);
        } catch (e) {
          throw new Error(`데이터 파싱 실패: ${text.slice(0, 50)}...`);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFactoryChange = (factory: string) => {
    setSelectedFactory(factory);
    setSelectedTeam('All');
    setSelectedCategory('All');
    setSelectedCodes(new Set());
  };

  const toggleSelect = (code: string) => {
    const newSet = new Set(selectedCodes);
    if (newSet.has(code)) newSet.delete(code);
    else newSet.add(code);
    setSelectedCodes(newSet);
  };

  const toggleSelectAll = (filteredList: ParetoRow[]) => {
    if (filteredList.every(row => selectedCodes.has(row.code))) {
      const newSet = new Set(selectedCodes);
      filteredList.forEach(row => newSet.delete(row.code));
      setSelectedCodes(newSet);
    } else {
      const newSet = new Set(selectedCodes);
      filteredList.forEach(row => newSet.add(row.code));
      setSelectedCodes(newSet);
    }
  };

  // 파레토 로직
  const processedData = useMemo(() => {
    let result = data;
    if (selectedFactory !== 'All') result = result.filter(row => row.factory === selectedFactory);
    if (selectedTeam !== 'All') result = result.filter(row => row.team === selectedTeam);
    if (selectedCategory !== 'All') result = result.filter(row => row.category === selectedCategory);

    result = result.sort((a, b) => b.q - a.q);

    const totalQ = result.reduce((acc, curr) => acc + curr.q, 0);
    let currentCumulativeQ = 0;

    return result.map(row => {
      currentCumulativeQ += row.q;
      return {
        ...row,
        cumulativeQ: currentCumulativeQ,
        cumulativeRatio: totalQ === 0 ? 0 : (currentCumulativeQ / totalQ) * 100
      };
    });
  }, [data, selectedFactory, selectedTeam, selectedCategory]);

  // 팝업 데이터
  const modalData = useMemo(() => {
    if (!isModalOpen) return { rows: [], totals: null };
    let selectedRows = data.filter(row => selectedCodes.has(row.code));
    selectedRows.sort((a, b) => b.q - a.q);

    const totalQ = selectedRows.reduce((acc, curr) => acc + curr.q, 0);
    let currentCumulativeQ = 0;

    const rows: ParetoRow[] = selectedRows.map(row => {
      currentCumulativeQ += row.q;
      return {
        ...row,
        cumulativeQ: currentCumulativeQ,
        cumulativeRatio: totalQ === 0 ? 0 : (currentCumulativeQ / totalQ) * 100
      };
    });

    const totals = rows.reduce((acc, curr) => ({
      q: acc.q,
      mat_total: acc.mat_total + curr.mat_total,
      process_total: acc.process_total + curr.process_total,
      total_cost: acc.total_cost + curr.total_cost
    }), { q: 0, mat_total: 0, process_total: 0, total_cost: 0 });

    return { rows, totals };
  }, [data, selectedCodes, isModalOpen]);

  // CSV 다운로드 (수정됨: 실적일 제거, 생산횟수 포맷 변경)
  const downloadCSV = () => {
    if (modalData.rows.length === 0) return;
    let csvContent = "\uFEFF";
    
    // 헤더 수정: 실적일 제거, 오더번호 -> 생산횟수
    csvContent += "순위,제품코드,제품명,생산실적(Q),누적비중(%),생산횟수,팀,카테고리,원자재,부자재,포장재,자소소재,재료비합계,감가상각비,직접노무비,간접노무비,유틸리티,기타경비,가공비합계,제조원가\n";

    modalData.rows.forEach((row, index) => {
      const line = [
        index + 1,
        row.code,
        `"${row.name.replace(/"/g, '""')}"`,
        row.q,
        row.cumulativeRatio.toFixed(2) + '%',
        `"${row.orderCount}회"`, // 수정됨: X회
        row.team,
        row.category,
        row.mat_raw,
        row.mat_sub,
        row.mat_pack,
        row.mat_self,
        row.mat_total,
        row.depreciation,
        row.labor_direct,
        row.labor_indirect,
        row.utility,
        row.etc,
        row.process_total,
        row.total_cost
      ].join(",");
      csvContent += line + "\n";
    });

    // 합계 행
    csvContent += `TOTAL,,,${modalData.totals?.q},,${modalData.totals?.orderCount || ''}회,,,,,${modalData.totals?.mat_total},,,,,,,${modalData.totals?.process_total},${modalData.totals?.total_cost}\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ABC분석_상세_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const teamOptions = useMemo(() => {
    let baseData = data.filter(row => selectedFactory === 'All' || row.factory === selectedFactory);
    const teams = Array.from(new Set(baseData.map(row => row.team))).filter(Boolean).sort();
    return ['All', ...teams];
  }, [data, selectedFactory]);

  const categoryOptions = useMemo(() => {
    let baseData = data.filter(row => selectedFactory === 'All' || row.factory === selectedFactory);
    if (selectedTeam !== 'All') baseData = baseData.filter(row => row.team === selectedTeam);
    const categories = Array.from(new Set(baseData.map(row => row.category))).filter(Boolean).sort();
    return ['All', ...categories];
  }, [data, selectedFactory, selectedTeam]);

  const safeNumber = (val: any) => (val === null || val === undefined || isNaN(val)) ? '0' : val.toLocaleString();

  if (loading) return <div className="p-10 text-xl font-bold flex justify-center text-gray-600">데이터 로딩 중... ⏳</div>;
  if (error) return <div className="p-10 text-red-500 border border-red-200 bg-red-50 m-4 rounded">에러: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      <div className="bg-white rounded-xl shadow-lg p-6 pb-20">
        
        {/* 헤더 */}
        <div className="flex flex-col gap-6 mb-6 border-b pb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">🏭 생산량 기반 ABC(파레토) 분석</h1>
              <p className="text-sm text-gray-500 mt-1">
                 총 {processedData.length}개 품목 중 <strong className="text-blue-600">{selectedCodes.size}개 선택됨</strong>
              </p>
            </div>
            {selectedCodes.size > 0 && (
              <button onClick={() => setIsModalOpen(true)} className="fixed bottom-8 right-8 z-50 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-xl animate-bounce-slow flex items-center gap-2">
                <span>🚀 선택 항목 ({selectedCodes.size}개) 정밀 분석</span>
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center bg-gray-100 p-3 rounded-lg justify-between">
            <div className="flex bg-white p-1 rounded-md shadow-sm">
              {['All', 'K1', 'K2', 'K3'].map((f) => (
                <button key={f} onClick={() => handleFactoryChange(f)} className={`px-5 py-2 text-sm font-bold rounded transition-all ${selectedFactory === f ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>{f === 'All' ? '전체 공장' : f}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-40 px-3 py-2 bg-white border border-gray-300 rounded text-sm"><option value="All">🏢 모든 팀</option>{teamOptions.map(t => t!=='All' && <option key={t} value={t}>{t}</option>)}</select>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-40 px-3 py-2 bg-white border border-gray-300 rounded text-sm"><option value="All">📦 모든 카테고리</option>{categoryOptions.map(c => c!=='All' && <option key={c} value={c}>{c}</option>)}</select>
            </div>
          </div>
        </div>
        
        {/* ⭐ 메인 테이블 (수정됨: 컬럼 변경) */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[70vh]">
          <table className="w-full text-xs text-left text-gray-600 whitespace-nowrap">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 font-bold sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-4 py-3 bg-gray-200 sticky left-0 z-10 w-10 text-center">
                  <input type="checkbox" onChange={() => toggleSelectAll(processedData)} checked={processedData.length>0 && processedData.every(row=>selectedCodes.has(row.code))} className="cursor-pointer"/>
                </th>
                <th className="px-4 py-3 bg-gray-200 sticky left-10 z-10 w-12 text-center">No.</th>
                <th className="px-4 py-3 bg-gray-200 sticky left-24 z-10 w-24">제품코드</th>
                <th className="px-4 py-3 bg-gray-200 sticky left-48 z-10 border-r border-gray-300">제품명</th>
                
                <th className="px-4 py-3 text-right bg-blue-50 text-blue-900 border-l border-blue-100">생산실적</th>
                <th className="px-4 py-3 text-right bg-orange-50 text-orange-900 border-r border-orange-100">누적비중</th>
                
                {/* [수정] 실적일 삭제, 오더번호 -> 생산횟수 */}
                <th className="px-4 py-3 text-gray-500 text-center">생산횟수</th>
                
                <th className="px-4 py-3">팀</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3 text-right">원자재</th>
                <th className="px-4 py-3 text-right">부자재</th>
                <th className="px-4 py-3 text-right">포장재</th>
                <th className="px-4 py-3 text-right">자소소재</th>
                <th className="px-4 py-3 text-right bg-yellow-50 font-bold border-l border-r border-yellow-100">재료비합계</th>
                <th className="px-4 py-3 text-right">감가상각</th>
                <th className="px-4 py-3 text-right">직접노무</th>
                <th className="px-4 py-3 text-right">간접노무</th>
                <th className="px-4 py-3 text-right">유틸리티</th>
                <th className="px-4 py-3 text-right">기타경비</th>
                <th className="px-4 py-3 text-right bg-green-50 font-bold border-l border-r border-green-100">가공비합계</th>
                <th className="px-4 py-3 text-right bg-red-50 text-red-900 font-extrabold border-l border-red-100">제조원가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedData.map((row, index) => {
                const isCoreItem = row.cumulativeRatio <= 80;
                const rowClass = isCoreItem ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'hover:bg-gray-50';
                const isSelected = selectedCodes.has(row.code);
                return (
                  <tr key={row.code} className={`${rowClass} transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 text-center bg-gray-50 sticky left-0 z-10"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(row.code)} className="cursor-pointer"/></td>
                    <td className="px-4 py-3 text-center font-bold text-gray-500 bg-gray-50 sticky left-10 z-10">{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 text-[10px] bg-gray-50 sticky left-24 z-10">{row.code}</td>
                    <td className="px-4 py-3 font-bold text-gray-800 text-sm bg-gray-50 sticky left-48 z-10 border-r border-gray-200 truncate max-w-[200px]">{row.name}</td>
                    
                    <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50/30">{safeNumber(row.q)}</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-800 bg-orange-50/30 relative">
                      <div className="absolute bottom-0 left-0 h-1 bg-orange-200" style={{ width: `${row.cumulativeRatio}%`, opacity: 0.3 }}></div>{row.cumulativeRatio.toFixed(1)}%
                    </td>
                    
                    {/* [수정] 실적일 삭제, 생산횟수로 포맷 변경 */}
                    <td className="px-4 py-3 text-gray-500 text-center text-xs">{row.orderCount}회</td>
                    
                    <td className="px-4 py-3 text-gray-500">{row.team}</td>
                    <td className="px-4 py-3 text-gray-500">{row.category}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.mat_raw)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.mat_sub)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.mat_pack)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.mat_self)}</td>
                    <td className="px-4 py-3 text-right font-bold bg-yellow-50/30">{safeNumber(row.mat_total)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.depreciation)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.labor_direct)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.labor_indirect)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.utility)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{safeNumber(row.etc)}</td>
                    <td className="px-4 py-3 text-right font-bold bg-green-50/30">{safeNumber(row.process_total)}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-red-600 bg-red-50/30 border-l border-red-100">{safeNumber(row.total_cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 팝업 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-xl">
              <div><h2 className="text-xl font-bold text-gray-800">📊 선택 항목 상세 분석</h2></div>
              <div className="flex gap-3">
                <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">📥 전체 원본 다운로드 (CSV)</button>
                <button onClick={() => setIsModalOpen(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold">닫기 ✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <table className="w-full text-xs text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">No.</th>
                    <th className="px-4 py-3">제품명</th>
                    <th className="px-4 py-3 text-right text-blue-800">생산실적(Q)</th>
                    <th className="px-4 py-3 text-right text-orange-800">선택 비중</th>
                    <th className="px-4 py-3 text-right bg-yellow-50">재료비</th>
                    <th className="px-4 py-3 text-right bg-green-50">가공비</th>
                    <th className="px-4 py-3 text-right bg-red-50">제조원가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modalData.rows.map((row, idx) => (
                    <tr key={row.code}>
                      <td className="px-4 py-3 text-center font-bold text-gray-500">{idx+1}</td>
                      <td className="px-4 py-3 font-bold">{row.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{safeNumber(row.q)}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{row.cumulativeRatio.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{safeNumber(row.mat_total)}</td>
                      <td className="px-4 py-3 text-right">{safeNumber(row.process_total)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{safeNumber(row.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 sticky bottom-0">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center">합 계 (Total)</td>
                    <td className="px-4 py-3 text-right text-blue-800">{safeNumber(modalData.totals?.q)}</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">{safeNumber(modalData.totals?.mat_total)}</td>
                    <td className="px-4 py-3 text-right">{safeNumber(modalData.totals?.process_total)}</td>
                    <td className="px-4 py-3 text-right text-red-800">{safeNumber(modalData.totals?.total_cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
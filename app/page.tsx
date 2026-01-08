'use client';

import { useEffect, useState, useMemo } from 'react';
import { Download, Search, X, BarChart3, Filter } from 'lucide-react';

// --- 타입 정의 ---
interface CostRow {
  factory: string;
  code: string;
  name: string;
  team: string;
  category: string;
  dateRange: string;
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

// --- 유틸리티 함수 ---
const safeNumber = (val: any) => (val === null || val === undefined || isNaN(val)) ? 0 : val;
const formatNum = (val: number) => new Intl.NumberFormat('ko-KR').format(val);

export default function Home() {
  // --- 상태 관리 ---
  const [data, setData] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedFactory, setSelectedFactory] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- 데이터 로드 ---
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

  // --- 필터 초기화 ---
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

  // --- 데이터 가공 (파레토 분석) ---
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

  // --- 팝업용 데이터 및 합계 ---
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
      q: acc.q + curr.q,
      orderCount: acc.orderCount + curr.orderCount,
      mat_raw: acc.mat_raw + curr.mat_raw,
      mat_sub: acc.mat_sub + curr.mat_sub,
      mat_pack: acc.mat_pack + curr.mat_pack,
      mat_self: acc.mat_self + curr.mat_self,
      mat_total: acc.mat_total + curr.mat_total,
      depreciation: acc.depreciation + curr.depreciation,
      labor_direct: acc.labor_direct + curr.labor_direct,
      labor_indirect: acc.labor_indirect + curr.labor_indirect,
      utility: acc.utility + curr.utility,
      etc: acc.etc + curr.etc,
      process_total: acc.process_total + curr.process_total,
      total_cost: acc.total_cost + curr.total_cost
    }), { 
      q: 0, orderCount: 0, mat_raw: 0, mat_sub: 0, mat_pack: 0, mat_self: 0, mat_total: 0,
      depreciation: 0, labor_direct: 0, labor_indirect: 0, utility: 0, etc: 0, process_total: 0, total_cost: 0 
    });

    return { rows, totals };
  }, [data, selectedCodes, isModalOpen]);

  // --- CSV 다운로드 ---
  const downloadCSV = () => {
    if (modalData.rows.length === 0) return;
    let csvContent = "\uFEFF";
    csvContent += "순위,제품코드,제품명,생산실적(Q),누적비중(%),생산횟수,팀,카테고리,원자재,부자재,포장재,자소소재,재료비합계,감가상각비,직접노무비,간접노무비,유틸리티,기타경비,가공비합계,제조원가\n";

    modalData.rows.forEach((row, index) => {
      const line = [
        index + 1, row.code, `"${row.name.replace(/"/g, '""')}"`, row.q, row.cumulativeRatio.toFixed(2) + '%',
        `"${row.orderCount}회"`, row.team, row.category, row.mat_raw, row.mat_sub, row.mat_pack, row.mat_self, row.mat_total,
        row.depreciation, row.labor_direct, row.labor_indirect, row.utility, row.etc, row.process_total, row.total_cost
      ].join(",");
      csvContent += line + "\n";
    });

    if (modalData.totals) {
      const t = modalData.totals;
      csvContent += [
        "TOTAL", "", "", t.q, "", `${t.orderCount}회`, "", "",
        t.mat_raw, t.mat_sub, t.mat_pack, t.mat_self, t.mat_total,
        t.depreciation, t.labor_direct, t.labor_indirect, t.utility, t.etc, t.process_total, t.total_cost
      ].join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ABC분석_상세_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 옵션 목록 ---
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


  // --- 로딩/에러 화면 ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium animate-pulse">데이터 분석 중...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="bg-white p-8 rounded-xl shadow-lg border-l-4 border-red-500 max-w-lg">
         <h3 className="text-xl font-bold text-red-600 mb-2">데이터 로드 실패</h3>
         <p className="text-slate-600">{error}</p>
         <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium transition-colors">다시 시도</button>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* 상단 네비게이션 & 필터 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
            
            {/* 타이틀 및 요약 */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Cost Insight</h1>
                <p className="text-xs text-slate-500 mt-1">
                  총 <span className="font-semibold text-slate-900">{processedData.length}</span>개 품목 / 
                  선택 <span className="font-bold text-indigo-600">{selectedCodes.size}</span>개
                </p>
              </div>
            </div>

            {/* 필터 그룹 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 공장 선택 버튼그룹 */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {['All', 'K1', 'K2', 'K3'].map((f) => (
                  <button 
                    key={f} 
                    onClick={() => handleFactoryChange(f)} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      selectedFactory === f 
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    {f === 'All' ? '전체' : f}
                  </button>
                ))}
              </div>

              {/* 드롭다운 필터 */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select 
                    value={selectedTeam} 
                    onChange={(e) => setSelectedTeam(e.target.value)} 
                    className="appearance-none pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-32 cursor-pointer"
                  >
                    <option value="All">팀 (전체)</option>
                    {teamOptions.map(t => t!=='All' && <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="relative">
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)} 
                    className="appearance-none pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-36 cursor-pointer"
                  >
                    <option value="All">카테고리 (전체)</option>
                    {categoryOptions.map(c => c!=='All' && <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 overflow-hidden p-4">
        <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          
          {/* 테이블 스크롤 영역 */}
          <div className="flex-1 overflow-auto w-full scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <table className="w-full text-xs text-left text-slate-600 border-collapse whitespace-nowrap">
              {/* 테이블 헤더 */}
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-20 shadow-sm ring-1 ring-slate-200">
                <tr>
                  <th className="px-3 py-3 w-10 text-center sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200">
                    <input 
                      type="checkbox" 
                      onChange={() => toggleSelectAll(processedData)} 
                      checked={processedData.length > 0 && processedData.every(row => selectedCodes.has(row.code))} 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 w-12 text-center sticky left-10 z-30 bg-slate-50 border-b border-r border-slate-200">No.</th>
                  <th className="px-3 py-3 w-20 sticky left-[5.5rem] z-30 bg-slate-50 border-b border-r border-slate-200">코드</th>
                  <th className="px-4 py-3 text-left sticky left-[10.5rem] z-30 bg-slate-50 border-b border-r border-slate-200 min-w-[200px]">제품명</th>
                  
                  <th className="px-3 py-3 text-right text-indigo-700 bg-indigo-50/50 border-b border-slate-200">생산실적(Q)</th>
                  <th className="px-3 py-3 text-right text-orange-700 bg-orange-50/50 border-b border-slate-200">누적비중</th>
                  <th className="px-3 py-3 text-center border-b border-slate-200">횟수</th>
                  
                  <th className="px-3 py-3 border-b border-slate-200">팀</th>
                  <th className="px-3 py-3 border-b border-r border-slate-200">카테고리</th>
                  
                  {/* 재료비 그룹 */}
                  <th className="px-3 py-3 text-right bg-yellow-50/30 border-b border-slate-200">원자재</th>
                  <th className="px-3 py-3 text-right bg-yellow-50/30 border-b border-slate-200">부자재</th>
                  <th className="px-3 py-3 text-right bg-yellow-50/30 border-b border-slate-200">포장재</th>
                  <th className="px-3 py-3 text-right bg-yellow-50/30 border-b border-slate-200">자소소재</th>
                  <th className="px-3 py-3 text-right font-bold bg-yellow-100/50 border-b border-r border-slate-200">재료비합계</th>
                  
                  {/* 가공비 그룹 */}
                  <th className="px-3 py-3 text-right bg-green-50/30 border-b border-slate-200">감가상각</th>
                  <th className="px-3 py-3 text-right bg-green-50/30 border-b border-slate-200">직접노무</th>
                  <th className="px-3 py-3 text-right bg-green-50/30 border-b border-slate-200">간접노무</th>
                  <th className="px-3 py-3 text-right bg-green-50/30 border-b border-slate-200">유틸리티</th>
                  <th className="px-3 py-3 text-right bg-green-50/30 border-b border-slate-200">기타경비</th>
                  <th className="px-3 py-3 text-right font-bold bg-green-100/50 border-b border-r border-slate-200">가공비합계</th>
                  
                  <th className="px-4 py-3 text-right font-bold text-slate-800 bg-slate-100 border-b border-slate-200">제조원가</th>
                </tr>
              </thead>
              
              {/* 테이블 본문 */}
              <tbody className="divide-y divide-slate-100">
                {processedData.map((row, index) => {
                  const isCoreItem = row.cumulativeRatio <= 80;
                  const isSelected = selectedCodes.has(row.code);
                  
                  return (
                    <tr 
                      key={row.code} 
                      className={`group transition-colors ${
                        isSelected 
                          ? 'bg-indigo-50 hover:bg-indigo-100/60' 
                          : isCoreItem 
                            ? 'bg-white hover:bg-slate-50' 
                            : 'bg-slate-50/30 hover:bg-slate-50 text-slate-400'
                      }`}
                    >
                      <td className={`px-3 py-2 text-center sticky left-0 z-10 border-r border-slate-200/60 ${isSelected ? 'bg-indigo-50' : 'bg-white group-hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(row.code)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                      </td>
                      <td className={`px-3 py-2 text-center font-medium sticky left-10 z-10 border-r border-slate-200/60 ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500 group-hover:bg-slate-50'}`}>
                        {index + 1}
                      </td>
                      <td className={`px-3 py-2 font-mono text-[10px] sticky left-[5.5rem] z-10 border-r border-slate-200/60 ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500 group-hover:bg-slate-50'}`}>
                        {row.code}
                      </td>
                      <td className={`px-4 py-2 font-medium truncate max-w-[240px] sticky left-[10.5rem] z-10 border-r border-slate-200/60 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'bg-white text-slate-700 group-hover:bg-slate-50'}`}>
                        {row.name}
                      </td>
                      
                      <td className="px-3 py-2 text-right font-semibold text-indigo-600 bg-indigo-50/30">{formatNum(row.q)}</td>
                      <td className="px-3 py-2 text-right relative bg-orange-50/30">
                        <span className={`relative z-10 ${isCoreItem ? 'text-orange-700 font-bold' : 'text-slate-400'}`}>{row.cumulativeRatio.toFixed(1)}%</span>
                        {/* 진행률 바 효과 (미세하게) */}
                        <div className="absolute left-0 bottom-0 h-0.5 bg-orange-400/20" style={{ width: `${Math.min(row.cumulativeRatio, 100)}%` }}></div>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">{row.orderCount}회</td>
                      
                      <td className="px-3 py-2 text-slate-500">{row.team}</td>
                      <td className="px-3 py-2 text-slate-500 border-r border-slate-100">{row.category}</td>
                      
                      <td className="px-3 py-2 text-right bg-yellow-50/10 text-slate-600">{formatNum(row.mat_raw)}</td>
                      <td className="px-3 py-2 text-right bg-yellow-50/10 text-slate-600">{formatNum(row.mat_sub)}</td>
                      <td className="px-3 py-2 text-right bg-yellow-50/10 text-slate-600">{formatNum(row.mat_pack)}</td>
                      <td className="px-3 py-2 text-right bg-yellow-50/10 text-slate-600">{formatNum(row.mat_self)}</td>
                      <td className="px-3 py-2 text-right font-medium bg-yellow-100/30 text-slate-800 border-r border-slate-100">{formatNum(row.mat_total)}</td>
                      
                      <td className="px-3 py-2 text-right bg-green-50/10 text-slate-600">{formatNum(row.depreciation)}</td>
                      <td className="px-3 py-2 text-right bg-green-50/10 text-slate-600">{formatNum(row.labor_direct)}</td>
                      <td className="px-3 py-2 text-right bg-green-50/10 text-slate-600">{formatNum(row.labor_indirect)}</td>
                      <td className="px-3 py-2 text-right bg-green-50/10 text-slate-600">{formatNum(row.utility)}</td>
                      <td className="px-3 py-2 text-right bg-green-50/10 text-slate-600">{formatNum(row.etc)}</td>
                      <td className="px-3 py-2 text-right font-medium bg-green-100/30 text-slate-800 border-r border-slate-100">{formatNum(row.process_total)}</td>
                      
                      <td className="px-4 py-2 text-right font-bold text-slate-900 bg-slate-50">{formatNum(row.total_cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 플로팅 액션 버튼 (선택된 항목 있을 때만 등장) */}
      {selectedCodes.size > 0 && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group flex items-center gap-3 bg-slate-900 text-white pl-5 pr-6 py-3.5 rounded-full shadow-2xl hover:bg-indigo-600 hover:scale-105 transition-all"
          >
            <div className="relative">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            </div>
            <span className="font-bold text-sm tracking-wide">
              {selectedCodes.size}개 항목 상세 분석
            </span>
          </button>
        </div>
      )}

      {/* 📊 팝업 모달 (디자인 개선됨) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          
          {/* 모달 콘텐츠 */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={24} />
                <h2 className="text-xl font-bold text-slate-800">선택 항목 집계 분석</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors shadow-sm">
                  <Download size={16} /> 엑셀 다운로드
                </button>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* 모달 테이블 영역 */}
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-xs text-left text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center bg-slate-50 border-b">No.</th>
                    <th className="px-4 py-3 bg-slate-50 border-b">제품명</th>
                    <th className="px-4 py-3 text-right text-indigo-700 bg-slate-50 border-b">생산실적</th>
                    <th className="px-4 py-3 text-right bg-slate-50 border-b">비중</th>
                    <th className="px-4 py-3 text-right bg-slate-50 border-b">재료비</th>
                    <th className="px-4 py-3 text-right bg-slate-50 border-b">가공비</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-50 border-b">제조원가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalData.rows.map((row, idx) => (
                    <tr key={row.code} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-400">{idx+1}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{row.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatNum(row.q)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.cumulativeRatio.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatNum(row.mat_total)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatNum(row.process_total)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatNum(row.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                
                {/* 모달 합계 (Footer) */}
                <tfoot className="bg-slate-100 font-bold text-slate-900 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center">합 계 (Total)</td>
                    <td className="px-4 py-4 text-right text-indigo-700">{formatNum(modalData.totals?.q || 0)}</td>
                    <td className="px-4 py-4 text-right">-</td>
                    <td className="px-4 py-4 text-right">{formatNum(modalData.totals?.mat_total || 0)}</td>
                    <td className="px-4 py-4 text-right">{formatNum(modalData.totals?.process_total || 0)}</td>
                    <td className="px-4 py-4 text-right text-red-600 text-sm">{formatNum(modalData.totals?.total_cost || 0)}</td>
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
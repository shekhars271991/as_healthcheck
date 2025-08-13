import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const parseNumeric = (v) => {
  if (v === undefined || v === null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const num = parseFloat(v.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? NaN : num;
  }
  return NaN;
};

const getMode = (ns) => {
  const cws = parseNumeric(ns?.clientWrites?.clientWriteSuccess || ns?.clientWrites?.success);
  const xws = parseNumeric(ns?.clientWrites?.xdrClientWriteSuccess);
  if (isNaN(cws) || isNaN(xws) || xws <= 0) return null;
  const base = cws === 0 ? (xws === 0 ? 1 : xws) : cws;
  const variance = Math.abs(xws - cws) / base;
  return variance <= 0.05 ? 'AP' : 'AA';
};

const XDRView = () => {
  const { healthCheckId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replicationFilter, setReplicationFilter] = useState('all'); // all | AP | AA

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:8000/health-checks/${healthCheckId}`);
        const json = await res.json();
        if (json.success) setData(json); else setError(json.message || 'Failed to fetch data');
      } catch (e) {
        setError('Failed to connect to backend');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [healthCheckId]);

  const { rows, topRegions } = useMemo(() => {
    if (!data?.regions) return { rows: [], topRegions: [] };
    const regionOrder = [];
    data.regions.forEach(r => { if (!regionOrder.includes(r.region_name)) regionOrder.push(r.region_name); });
    const topRegions = regionOrder.slice(0, 3);

    // Map of namespaceName -> aggregate
    const map = new Map();
    data.regions.forEach((region) => {
      (region.clusters || []).forEach((cluster) => {
        const namespaces = cluster?.data?.namespaces || [];
        const clusterName = cluster?.data?.clusterInfo?.name || cluster?.cluster_name || 'N/A';
        namespaces.forEach((ns) => {
          const key = ns?.name || 'unknown';
          const entry = map.get(key) || { 
            name: key, 
            clusterNames: new Set(), 
            perRegion: {},
            hasXdr: false,
          };
          entry.clusterNames.add(clusterName);
          const rname = region.region_name;
          const bucket = entry.perRegion[rname] || { license: 0, modeAA: false, modeAP: false };
          const lic = parseNumeric(ns?.license?.usage);
          if (!isNaN(lic)) bucket.license += lic;
          const mode = getMode(ns);
          if (mode === 'AA') bucket.modeAA = true; else if (mode === 'AP') bucket.modeAP = true;
          const xws = parseNumeric(ns?.clientWrites?.xdrClientWriteSuccess);
          if (!isNaN(xws) && xws > 0) entry.hasXdr = true;
          entry.perRegion[rname] = bucket;
          map.set(key, entry);
        });
      });
    });

    const rows = Array.from(map.values()).map((e) => {
      const regionCells = {};
      topRegions.forEach((r) => {
        const b = e.perRegion[r];
        if (b) {
          const licenseStr = b.license > 0 ? `${b.license.toFixed(2)} GB` : 'N/A';
          regionCells[r] = licenseStr;
        } else {
          regionCells[r] = '—';
        }
      });
      // choose the first cluster name
      const clusterName = e.clusterNames.values().next().value || 'N/A';

      // Compute replication (AP/AA) and overall license usage using all regions with data
      const licVals = Object.values(e.perRegion)
        .map((b) => (b && typeof b.license === 'number' ? b.license : NaN))
        .filter((n) => !isNaN(n) && n > 0);
      let replication = '—';
      let overallLic = 0;
      if (licVals.length >= 2) {
        const maxV = Math.max(...licVals);
        const minV = Math.min(...licVals);
        const variance = (maxV - minV) / (maxV === 0 ? 1 : maxV);
        replication = variance <= 0.05 ? 'AP' : 'AA';
        // Overall license usage: greatest among regions (applies to both AP and AA)
        overallLic = maxV;
      } else if (licVals.length === 1) {
        // Single region with data – treat as AP average (same value)
        replication = 'AP';
        overallLic = licVals[0];
      }
      return {
        name: e.name,
        clusterName,
        regionCells,
        hasXdr: e.hasXdr,
        replication,
        overallLicense: overallLic > 0 ? `${overallLic.toFixed(2)} GB` : 'N/A',
      };
    }).sort((a,b)=> a.name.localeCompare(b.name));

    return { rows, topRegions };
  }, [data?.regions]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading XDR view...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <button onClick={()=>navigate(`/health-check/${healthCheckId}`)} className="text-sm text-gray-500 hover:text-gray-700 mb-3">← Back to Overview</button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">XDR View</h1>
        <div className="flex items-center space-x-3">
          <label className="text-sm text-gray-600">Replication:</label>
          <select
            value={replicationFilter}
            onChange={(e)=>setReplicationFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
          >
            <option value="all">All</option>
            <option value="AP">AP</option>
            <option value="AA">AA</option>
          </select>
        </div>
      </div>
      {/* XDR namespaces table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">XDR Namespaces</div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replication</th>
              {topRegions.map((r) => (
                <th key={r} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Usage in {r}</th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall License Usage</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows
              .filter(r=>r.hasXdr)
              .filter(r=> replicationFilter==='all' ? true : r.replication === replicationFilter)
              .map((row)=> (
              <tr key={row.name} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-mono text-gray-900">{row.name}</td>
                <td className="px-6 py-3 text-sm text-gray-900 font-mono">{row.clusterName}</td>
                <td className="px-6 py-3 text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${row.replication==='AA' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}`}>{row.replication}</span>
                </td>
                {topRegions.map((r) => (
                  <td key={r} className="px-6 py-3 text-sm text-gray-900 font-mono">{row.regionCells[r]}</td>
                ))}
                <td className="px-6 py-3 text-sm text-gray-900 font-mono">{row.overallLicense}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Standalone namespaces table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">Standalone Namespaces (no XDR)</div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
              {topRegions.map((r) => (
                <th key={r} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Usage in {r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.filter(r=>!r.hasXdr).map((row)=> (
              <tr key={row.name} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-mono text-gray-900">{row.name}</td>
                <td className="px-6 py-3 text-sm text-gray-900 font-mono">{row.clusterName}</td>
                {topRegions.map((r) => (
                  <td key={r} className="px-6 py-3 text-sm text-gray-900 font-mono">{row.regionCells[r]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default XDRView;



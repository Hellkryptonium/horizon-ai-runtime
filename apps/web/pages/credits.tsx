import { useMemo, useState } from "react";
import { ArrowUpRight, Check, CircleDollarSign, Clock3, Cpu, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { PageHeader, StatCard } from "../components/ui/Primitives";

type Period = "7d" | "30d" | "90d";

const mockWorkers = [
  { id: "atlas", name: "Atlas Studio", status: "ONLINE", specs: "12 cores · 32 GB RAM · RTX 4070", rate: 7.2, uptime: "98.4%" },
  { id: "lab", name: "Research Lab", status: "ONLINE", specs: "8 cores · 16 GB RAM · CPU only", rate: 3.8, uptime: "94.1%" },
];

const activity = [
  { date: "Today, 14:32", worker: "Atlas Studio", duration: "2h 18m", credits: "+16.56" },
  { date: "Today, 09:10", worker: "Research Lab", duration: "1h 42m", credits: "+6.46" },
  { date: "Yesterday, 18:44", worker: "Atlas Studio", duration: "3h 05m", credits: "+22.20" },
  { date: "Yesterday, 11:26", worker: "Research Lab", duration: "48m", credits: "+3.04" },
];

export default function Credits() {
  const [period, setPeriod] = useState<Period>("30d");
  const [available, setAvailable] = useState<Record<string, boolean>>({ atlas: true, lab: false });
  const [message, setMessage] = useState("");
  const periodMultiplier = period === "7d" ? 0.34 : period === "90d" ? 2.7 : 1;
  const projected = useMemo(() => (42.3 * periodMultiplier).toFixed(2), [periodMultiplier]);
  const rentedWorkers = Object.values(available).filter(Boolean).length;

  const toggleWorker = (workerId: string) => {
    setAvailable((current) => ({ ...current, [workerId]: !current[workerId] }));
    setMessage("");
  };

  return <>
    <PageHeader title="Compute credits" description="Earn credits by making your hardware available for AI workloads." action={<button className="button primary" onClick={() => setMessage("Payout request queued in demo mode.")}><WalletCards size={15} /> Request payout</button>} />
    <div className="credits-banner"><div className="credits-banner-icon"><CircleDollarSign size={22} /></div><div><strong>Your hardware can work while you are away.</strong><p>Set a worker to available, choose what it can accept, and earn credits when jobs use its capacity.</p></div><div className="credits-banner-stat"><span>Current balance</span><b>128.40</b><small>HZN credits</small></div></div>
    <div className="stats-grid credits-stats"><StatCard label="Available balance" value="128.40" detail="+42.30 this month" tone="green" /><StatCard label="Projected earnings" value={`${projected}`} detail={period === "30d" ? "This month" : `Based on the last ${period}`} tone="blue" /><StatCard label="Hours rented" value="18.6" detail="Across your workers" tone="amber" /><StatCard label="Network reliability" value="97.1%" detail="Last 30 days" tone="green" /></div>

    <div className="section-heading"><h2>Rent your hardware</h2><span className="credits-live"><span className="status-dot online" /> Mock marketplace active</span></div>
    <section className="credits-worker-grid">{mockWorkers.map((worker) => <article className={`panel credits-worker ${available[worker.id] ? "is-available" : ""}`} key={worker.id}><div className="credits-worker-head"><div className="credits-worker-icon"><Cpu size={18} /></div><div><h3>{worker.name}</h3><span><span className={`status-dot ${available[worker.id] ? "online" : "offline"}`} /> {available[worker.id] ? "Accepting workloads" : "Not accepting jobs"}</span></div><button className={`credits-toggle ${available[worker.id] ? "on" : ""}`} aria-label={`${available[worker.id] ? "Stop" : "Start"} renting ${worker.name}`} aria-pressed={available[worker.id]} onClick={() => toggleWorker(worker.id)}><span /></button></div><p className="credits-worker-specs">{worker.specs}</p><div className="credits-worker-details"><div><span>Hourly rate</span><strong>{worker.rate.toFixed(2)} <small>HZN/hr</small></strong></div><div><span>Uptime</span><strong>{worker.uptime}</strong></div></div><div className="credits-worker-footer"><span>{available[worker.id] ? "Eligible for new jobs" : "Worker paused"}</span><button className="button quiet" onClick={() => toggleWorker(worker.id)}>{available[worker.id] ? "Pause rentals" : "Make available"}</button></div></article>)}</section>

    <div className="credits-content-grid"><section><div className="section-heading"><h2>Credit activity</h2><div className="credits-periods" role="group" aria-label="Activity period">{(["7d", "30d", "90d"] as Period[]).map((value) => <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{value}</button>)}</div></div><section className="panel"><div className="credits-table-wrap"><table><thead><tr><th>Date</th><th>Worker</th><th>Runtime</th><th>Credits</th></tr></thead><tbody>{activity.map((entry) => <tr key={`${entry.date}-${entry.worker}`}><td>{entry.date}</td><td><strong>{entry.worker}</strong></td><td>{entry.duration}</td><td className="credits-positive">{entry.credits} HZN</td></tr>)}</tbody></table></div></section></section><aside className="panel credits-how"><div className="section-heading" style={{ marginTop: 0 }}><h2>How earning works</h2><Gauge size={17} color="var(--blue)" /></div><div className="credits-step"><span>01</span><div><strong>Stay available</strong><p>Keep the Worker Agent connected and healthy.</p></div></div><div className="credits-step"><span>02</span><div><strong>Serve verified jobs</strong><p>Credits are calculated from accepted runtime hours.</p></div></div><div className="credits-step"><span>03</span><div><strong>Build your balance</strong><p>Request a payout when your balance is ready.</p></div></div><div className="credits-trust"><ShieldCheck size={16} /><span>Only verified, completed workloads earn credits.</span></div></aside></div>
    {message && <div className="inline-state credits-message"><Check size={15} /> {message}</div>}
    <p className="credits-disclaimer"><Clock3 size={13} /> Demo data is simulated for the MVP. Live credit accounting will connect to completed job records.</p>
  </>;
}
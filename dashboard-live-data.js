// ═══════════════════════════════════════════════════════════════
// HemmTrack Pro — Live Data Connector
// ═══════════════════════════════════════════════════════════════
// DROP THIS INTO YOUR dashboard.html <script> SECTION
// Replace ALL existing mock data + chart initialization with this.
// UI/CSS stays exactly the same — only data logic changes.
// ═══════════════════════════════════════════════════════════════

const API_BASE = "https://hemmtrack-flask-backend-production.up.railway.app";
const REFRESH_INTERVAL = 5000; // 5 seconds

// ── Chart instances (will be created once, then updated) ──
let stationChart = null;
let defectTypeChart = null;
let shiftChart = null;

// ── Color palette matching your existing UI ──
const COLORS = {
    primary:  ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"],
    station:  ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"],
    defect:   ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#ec4899"],
    shift:    ["#3b82f6", "#22c55e", "#f97316"],
};


// ═══════════════════════════════════════════════
// 1. FETCH DATA FROM BACKEND
// ═══════════════════════════════════════════════

async function fetchStats() {
    try {
        const res = await fetch(`${API_BASE}/get_stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        updateDashboard(data);
        setConnectionStatus(true);
    } catch (err) {
        console.error("[HemmTrack] Fetch failed:", err);
        setConnectionStatus(false);
    }
}


// ═══════════════════════════════════════════════
// 2. UPDATE STAT CARDS
// ═══════════════════════════════════════════════

function updateCards(data) {
    // Map your card element IDs to data keys
    // Adjust these selectors to match YOUR dashboard.html
    const cardMap = {
        "total-defects":  data.total_defects,
        "high-defects":   data.high_defects,
        "stations-count": data.stations,
        "alerts-count":   data.alerts,
    };

    for (const [id, value] of Object.entries(cardMap)) {
        const el = document.getElementById(id);
        if (el) {
            // Animate number change
            animateNumber(el, parseInt(el.textContent) || 0, value, 400);
        }
    }

    // Update last-refreshed timestamp
    const tsEl = document.getElementById("last-updated");
    if (tsEl) {
        tsEl.textContent = `Last updated: ${data.last_updated || new Date().toLocaleTimeString()}`;
    }
}


// ═══════════════════════════════════════════════
// 3. UPDATE CHARTS
// ═══════════════════════════════════════════════

function updateCharts(data) {
    // ── Station-wise Bar Chart ──
    if (data.by_station) {
        const labels = Object.keys(data.by_station);
        const values = Object.values(data.by_station);

        if (stationChart) {
            stationChart.data.labels = labels;
            stationChart.data.datasets[0].data = values;
            stationChart.update("none"); // no animation on refresh
        } else {
            const ctx = document.getElementById("stationChart");
            if (ctx) {
                stationChart = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels,
                        datasets: [{
                            label: "Defects",
                            data: values,
                            backgroundColor: COLORS.station.slice(0, labels.length),
                            borderRadius: 6,
                            borderSkipped: false,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        },
                    },
                });
            }
        }
    }

    // ── Defect Type Doughnut Chart ──
    if (data.defect_types) {
        const labels = Object.keys(data.defect_types);
        const values = Object.values(data.defect_types);

        if (defectTypeChart) {
            defectTypeChart.data.labels = labels;
            defectTypeChart.data.datasets[0].data = values;
            defectTypeChart.update("none");
        } else {
            const ctx = document.getElementById("defectTypeChart");
            if (ctx) {
                defectTypeChart = new Chart(ctx, {
                    type: "doughnut",
                    data: {
                        labels,
                        datasets: [{
                            data: values,
                            backgroundColor: COLORS.defect.slice(0, labels.length),
                            borderWidth: 0,
                            hoverOffset: 8,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "65%",
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 },
                            },
                        },
                    },
                });
            }
        }
    }

    // ── Shift-wise Pie/Bar Chart (optional) ──
    if (data.by_shift) {
        const labels = Object.keys(data.by_shift).map(s => `Shift ${s}`);
        const values = Object.values(data.by_shift);

        if (shiftChart) {
            shiftChart.data.labels = labels;
            shiftChart.data.datasets[0].data = values;
            shiftChart.update("none");
        } else {
            const ctx = document.getElementById("shiftChart");
            if (ctx) {
                shiftChart = new Chart(ctx, {
                    type: "pie",
                    data: {
                        labels,
                        datasets: [{
                            data: values,
                            backgroundColor: COLORS.shift,
                            borderWidth: 0,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: { padding: 12, usePointStyle: true },
                            },
                        },
                    },
                });
            }
        }
    }
}


// ═══════════════════════════════════════════════
// 4. UPDATE RECENT DEFECTS TABLE
// ═══════════════════════════════════════════════

function updateTable(data) {
    const tbody = document.getElementById("defect-table-body");
    if (!tbody || !data.recent) return;

    // Build rows
    const rows = data.recent.map((r, i) => {
        const statusClass = {
            "High":   "status-high",
            "Medium": "status-medium",
            "Low":    "status-low",
        }[r.status] || "";

        return `
            <tr>
                <td>${i + 1}</td>
                <td>${r.station}</td>
                <td>${r.defect}</td>
                <td>${r.shift}</td>
                <td>${r.time}</td>
                <td><span class="status-badge ${statusClass}">${r.status}</span></td>
            </tr>
        `;
    }).join("");

    tbody.innerHTML = rows;
}


// ═══════════════════════════════════════════════
// 5. HELPERS
// ═══════════════════════════════════════════════

function animateNumber(el, from, to, duration) {
    if (from === to) return;
    const start = performance.now();
    const step = (ts) => {
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function setConnectionStatus(connected) {
    const indicator = document.getElementById("connection-status");
    if (!indicator) return;
    indicator.textContent = connected ? "● Live" : "● Offline";
    indicator.style.color = connected ? "#22c55e" : "#ef4444";
}


// ═══════════════════════════════════════════════
// 6. MASTER UPDATE
// ═══════════════════════════════════════════════

function updateDashboard(data) {
    updateCards(data);
    updateCharts(data);
    updateTable(data);
}


// ═══════════════════════════════════════════════
// 7. INIT — First fetch + auto-refresh
// ═══════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch
    fetchStats();

    // Auto-refresh every 5 seconds
    setInterval(fetchStats, REFRESH_INTERVAL);

    console.log(`[HemmTrack] Live data connected → ${API_BASE}/get_stats`);
    console.log(`[HemmTrack] Auto-refresh: every ${REFRESH_INTERVAL / 1000}s`);
});

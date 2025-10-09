import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  MinusCircle,
  Calculator,
  Users,
  TrendingUp,
  FileText,
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  AlertCircle,
} from "lucide-react";

export default function IPOPoolManager() {
  const [savedProjects, setSavedProjects] = useState(() => {
    // Load saved projects from localStorage on component mount
    const saved = localStorage.getItem('ipo-saved-projects');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [showProjectList, setShowProjectList] = useState(false);

  const [ipoDetails, setIpoDetails] = useState({
    name: "",
    applicationDate: "",
    ipoPrice: 0,
    lotSize: 100,
  });

  const [participants, setParticipants] = useState([
    {
      id: 1,
      name: "Person A",
      initialCapital: 10000,
      willApply: true,
      lotsApplied: 0,
      gotAllocation: false,
      lotsAllocated: 0,
      sellingPrice: 0,
      sellingFee: 0,
    },
  ]);

  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState("ipo");

  // Save projects to localStorage whenever savedProjects changes
  useEffect(() => {
    localStorage.setItem('ipo-saved-projects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  const calculateMaxLots = (capital, ipoPrice, lotSize) => {
    if (!ipoPrice || !lotSize || !capital) return 0;
    const maxLots = Math.floor(
      Number(capital) / (Number(ipoPrice) * Number(lotSize))
    );
    return maxLots;
  };

  const applyMaxLots = (participantId) => {
    const participant = participants.find((p) => p.id === participantId);
    if (participant) {
      const maxLots = calculateMaxLots(
        participant.initialCapital,
        ipoDetails.ipoPrice,
        ipoDetails.lotSize
      );
      updateParticipant(participantId, "lotsApplied", maxLots);
    }
  };

  const saveCurrentProject = () => {
    const projectName = ipoDetails.name || "Untitled IPO";
    const projectData = {
      id: currentProjectId || Date.now(),
      savedDate: new Date().toISOString(),
      ipoDetails,
      participants,
      transfers,
    };

    if (currentProjectId) {
      setSavedProjects(
        savedProjects.map((p) => (p.id === currentProjectId ? projectData : p))
      );
    } else {
      setSavedProjects([...savedProjects, projectData]);
      setCurrentProjectId(projectData.id);
    }

    alert(`Project "${projectName}" saved successfully!`);
  };

  const loadProject = (project) => {
    setIpoDetails(project.ipoDetails);
    setParticipants(project.participants);
    setTransfers(project.transfers);
    setCurrentProjectId(project.id);
    setShowProjectList(false);
    setActiveTab("ipo");
  };

  const createNewProject = () => {
    if (
      ipoDetails.name &&
      !confirm("Create new project? Unsaved changes will be lost.")
    ) {
      return;
    }

    setIpoDetails({
      name: "",
      applicationDate: "",
      ipoPrice: 0,
      lotSize: 100,
    });
    setParticipants([
      {
        id: 1,
        name: "Person A",
        initialCapital: 10000,
        willApply: true,
        lotsApplied: 0,
        gotAllocation: false,
        lotsAllocated: 0,
        sellingPrice: 0,
        sellingFee: 0,
      },
    ]);
    setTransfers([]);
    setCurrentProjectId(null);
    setActiveTab("ipo");
  };

  const deleteProject = (projectId) => {
    if (confirm("Delete this project permanently?")) {
      setSavedProjects(savedProjects.filter((p) => p.id !== projectId));
      if (currentProjectId === projectId) {
        createNewProject();
      }
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(savedProjects, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ipo-pool-projects-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setSavedProjects(imported);
          alert(`Successfully imported ${imported.length} project(s)!`);
        } catch (error) {
          alert("Error importing file. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const addParticipant = () => {
    const newId = Math.max(0, ...participants.map((p) => p.id)) + 1;
    setParticipants([
      ...participants,
      {
        id: newId,
        name: `Person ${String.fromCharCode(64 + newId)}`,
        initialCapital: 0,
        willApply: true,
        lotsApplied: 0,
        gotAllocation: false,
        lotsAllocated: 0,
        sellingPrice: 0,
        sellingFee: 0,
      },
    ]);
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter((p) => p.id !== id));
    setTransfers(transfers.filter((t) => t.from !== id && t.to !== id));
  };

  const updateParticipant = (id, field, value) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const addTransfer = () => {
    if (participants.length >= 2) {
      setTransfers([
        ...transfers,
        {
          id: Date.now(),
          from: participants[0].id,
          to: participants[1].id,
          amount: 0,
          reason: "Tier matching",
        },
      ]);
    }
  };

  const removeTransfer = (id) => {
    setTransfers(transfers.filter((t) => t.id !== id));
  };

  const updateTransfer = (id, field, value) => {
    setTransfers(
      transfers.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const calculateParticipantDetails = (p) => {
    const ipoPrice = Number(ipoDetails.ipoPrice);
    const sellingPrice = Number(p.sellingPrice);
    const lotSize = Number(ipoDetails.lotSize);
    const sellingFee = Number(p.sellingFee);

    const lotsApplied = Number(p.lotsApplied);
    const lotsAllocated = Number(p.lotsAllocated);

    const capitalUsedToApply = lotsApplied * ipoPrice * lotSize;
    const allocatedAmount = lotsAllocated * ipoPrice * lotSize;
    const grossProfit = lotsAllocated * (sellingPrice - ipoPrice) * lotSize;
    const profitLoss = grossProfit - sellingFee;

    return {
      capitalUsedToApply,
      allocatedAmount,
      profitLoss,
      grossProfit,
    };
  };

  const calculateDistribution = () => {
    const totalCapital = participants.reduce(
      (sum, p) => sum + Number(p.initialCapital),
      0
    );

    const totalProfit = participants.reduce((sum, p) => {
      const details = calculateParticipantDetails(p);
      return sum + details.profitLoss;
    }, 0);

    const whoGotAllocation = participants.filter((p) => p.gotAllocation);
    const whoApplied = participants.filter((p) => p.willApply);
    const onlyCapitalProviders = participants.filter((p) => !p.willApply);

    let distribution = participants.map((p) => {
      const details = calculateParticipantDetails(p);
      return {
        ...p,
        ...details,
        capitalPercent:
          totalCapital > 0
            ? (Number(p.initialCapital) / totalCapital) * 100
            : 0,
        profitShare: 0,
        actualProfitReceived: details.profitLoss,
        tierMatchingTransferOut: 0,
        tierMatchingTransferIn: 0,
        settlementTransferOut: 0,
        settlementTransferIn: 0,
        netPosition: 0,
      };
    });

    if (totalProfit !== 0 && whoGotAllocation.length > 0) {
      if (onlyCapitalProviders.length === 0) {
        const bonusPool = totalProfit * 0.1;
        const mainPool = totalProfit * 0.9;
        const bonusPerWinner = bonusPool / whoGotAllocation.length;

        distribution = distribution.map((p) => {
          let share = (Number(p.initialCapital) / totalCapital) * mainPool;
          if (p.gotAllocation) {
            share += bonusPerWinner;
          }
          return { ...p, profitShare: share };
        });
      } else {
        const applierBonus = totalProfit * 0.3;
        const capitalPool = totalProfit * 0.7;
        const bonusPerApplier = applierBonus / whoApplied.length;

        distribution = distribution.map((p) => {
          let share = (Number(p.initialCapital) / totalCapital) * capitalPool;
          if (p.willApply) {
            share += bonusPerApplier;
          }
          return { ...p, profitShare: share };
        });
      }
    }

    distribution = distribution.map((p) => {
      const tierMatchingTransferOut = transfers
        .filter((t) => t.from === p.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const tierMatchingTransferIn = transfers
        .filter((t) => t.to === p.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return { ...p, tierMatchingTransferOut, tierMatchingTransferIn };
    });

    distribution = distribution.map((p) => {
      if (p.gotAllocation) {
        const settlementTransferOut = p.actualProfitReceived - p.profitShare;
        return {
          ...p,
          settlementTransferOut: Math.max(0, settlementTransferOut),
        };
      } else {
        const settlementTransferIn = p.profitShare;
        return { ...p, settlementTransferIn };
      }
    });

    distribution = distribution.map((p) => {
      const netPosition =
        p.profitShare + p.tierMatchingTransferIn - p.tierMatchingTransferOut;
      return { ...p, netPosition };
    });

    return distribution;
  };

  const calculateSettlementPairs = () => {
    const distribution = calculateDistribution();
    const creditors = distribution
      .filter((p) => p.netPosition > 0)
      .sort((a, b) => b.netPosition - a.netPosition);
    const debtors = distribution
      .filter((p) => p.netPosition < 0)
      .sort((a, b) => a.netPosition - b.netPosition);

    const settlements = [];
    let i = 0,
      j = 0;

    const creditorsCopy = creditors.map((c) => ({
      ...c,
      remaining: c.netPosition,
    }));
    const debtorsCopy = debtors.map((d) => ({
      ...d,
      remaining: Math.abs(d.netPosition),
    }));

    while (i < creditorsCopy.length && j < debtorsCopy.length) {
      const creditor = creditorsCopy[i];
      const debtor = debtorsCopy[j];

      const amount = Math.min(creditor.remaining, debtor.remaining);

      if (amount > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: amount,
        });
      }

      creditor.remaining -= amount;
      debtor.remaining -= amount;

      if (creditor.remaining < 0.01) i++;
      if (debtor.remaining < 0.01) j++;
    }

    return settlements;
  };

  const distribution = calculateDistribution();
  const totalCapital = participants.reduce(
    (sum, p) => sum + Number(p.initialCapital),
    0
  );
  const totalLotsApplied = participants.reduce(
    (sum, p) => sum + Number(p.lotsApplied),
    0
  );
  const totalLotsAllocated = participants.reduce(
    (sum, p) => sum + Number(p.lotsAllocated),
    0
  );
  const totalCapitalUsed = distribution.reduce(
    (sum, p) => sum + p.capitalUsedToApply,
    0
  );
  const totalAllocated = distribution.reduce(
    (sum, p) => sum + p.allocatedAmount,
    0
  );
  const totalProfitLoss = distribution.reduce(
    (sum, p) => sum + p.profitLoss,
    0
  );
  const whoApplied = participants.filter((p) => p.willApply);
  const whoGotAllocation = participants.filter((p) => p.gotAllocation);
  const onlyCapitalProviders = participants.filter((p) => !p.willApply);

  const hasAllocationData = whoGotAllocation.length > 0;
  const hasSellingPrice = whoGotAllocation.some(
    (p) => Number(p.sellingPrice) > 0
  );
  const canShowDistribution = hasAllocationData && hasSellingPrice;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  IPO Pooling Fund Manager
                </h1>
                <p className="text-gray-600 text-sm">
                  Track multiple IPO projects over time
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createNewProject}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                New
              </button>
              <button
                onClick={saveCurrentProject}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                Save
              </button>
              <button
                onClick={() => setShowProjectList(!showProjectList)}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                Projects ({savedProjects.length})
              </button>
            </div>
          </div>

          {ipoDetails.name && (
            <div className="mt-3 text-sm text-gray-600">
              Current:{" "}
              <span className="font-semibold text-indigo-600">
                {ipoDetails.name}
              </span>
              {currentProjectId && (
                <span className="ml-2 text-green-600">● Saved</span>
              )}
            </div>
          )}
        </div>

        {showProjectList && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Saved IPO Projects
              </h2>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                  <Upload className="w-5 h-5" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={exportData}
                  disabled={savedProjects.length === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                  <Download className="w-5 h-5" />
                  Export All
                </button>
              </div>
            </div>

            {savedProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No saved projects yet. Save your current project to see it here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {project.ipoDetails.name || "Untitled"}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Saved: {new Date(project.savedDate).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="text-sm text-gray-600 mb-3">
                      <p>• {project.participants.length} participants</p>
                      <p>
                        • Total capital: RM{" "}
                        {project.participants
                          .reduce((s, p) => s + Number(p.initialCapital), 0)
                          .toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={() => loadProject(project)}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Load Project
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab("ipo")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "ipo"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FileText className="w-5 h-5 inline mr-2" />
              IPO Details
            </button>
            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "participants"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              Participants
            </button>
            <button
              onClick={() => setActiveTab("transfers")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "transfers"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              Fund Transfers
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "results"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Calculator className="w-5 h-5 inline mr-2" />
              Distribution
            </button>
          </div>

          <div className="p-6">
            {activeTab === "ipo" && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  IPO Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IPO Name *
                    </label>
                    <input
                      type="text"
                      value={ipoDetails.name}
                      onChange={(e) =>
                        setIpoDetails({ ...ipoDetails, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="e.g., ABC Company Bhd"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Date
                    </label>
                    <input
                      type="date"
                      value={ipoDetails.applicationDate}
                      onChange={(e) =>
                        setIpoDetails({
                          ...ipoDetails,
                          applicationDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IPO Price (RM per share) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ipoDetails.ipoPrice}
                      onChange={(e) =>
                        setIpoDetails({
                          ...ipoDetails,
                          ipoPrice: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="e.g., 1.50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lot Size (shares per lot)
                      <span className="text-xs text-gray-500 ml-1">
                        - Usually 100
                      </span>
                    </label>
                    <input
                      type="number"
                      value={ipoDetails.lotSize}
                      onChange={(e) =>
                        setIpoDetails({
                          ...ipoDetails,
                          lotSize: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                    <div className="text-xs text-blue-600 font-medium mb-1">
                      Total Pool Capital
                    </div>
                    <div className="text-xl font-bold text-blue-900">
                      RM {totalCapital.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {participants.length} participants
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
                    <div className="text-xs text-purple-600 font-medium mb-1">
                      Total Applied
                    </div>
                    <div className="text-xl font-bold text-purple-900">
                      {totalLotsApplied.toLocaleString()} lots
                    </div>
                    <div className="text-xs text-purple-600">
                      RM {totalCapitalUsed.toLocaleString()}
                    </div>
                  </div>

                  {hasAllocationData && (
                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                      <div className="text-xs text-green-600 font-medium mb-1">
                        Total Allocated
                      </div>
                      <div className="text-xl font-bold text-green-900">
                        {totalLotsAllocated.toLocaleString()} lots
                      </div>
                      <div className="text-xs text-green-600">
                        RM {totalAllocated.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {hasSellingPrice && (
                    <div
                      className={`rounded-lg p-4 border-l-4 ${
                        totalProfitLoss >= 0
                          ? "bg-emerald-50 border-emerald-500"
                          : "bg-red-50 border-red-500"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 ${
                          totalProfitLoss >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        Total {totalProfitLoss >= 0 ? "Profit" : "Loss"}
                      </div>
                      <div
                        className={`text-xl font-bold ${
                          totalProfitLoss >= 0
                            ? "text-emerald-900"
                            : "text-red-900"
                        }`}
                      >
                        RM{" "}
                        {Math.abs(totalProfitLoss).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {whoApplied.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3">
                      Applications Summary
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">
                              Participant
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700">
                              Initial Capital
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700">
                              Lots Applied
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700">
                              Capital Used
                            </th>
                            {hasAllocationData && (
                              <>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700">
                                  Status
                                </th>
                                <th className="text-right py-2 px-3 font-semibold text-gray-700">
                                  Lots Allocated
                                </th>
                                <th className="text-right py-2 px-3 font-semibold text-gray-700">
                                  Selling Price
                                </th>
                              </>
                            )}
                            {hasSellingPrice && (
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">
                                Profit/Loss
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {participants
                            .filter((p) => p.willApply)
                            .map((p) => {
                              const details = calculateParticipantDetails(p);
                              return (
                                <tr
                                  key={p.id}
                                  className="border-b hover:bg-gray-50"
                                >
                                  <td className="py-2 px-3 font-medium">
                                    {p.name}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-600">
                                    RM{" "}
                                    {Number(p.initialCapital).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium">
                                    {p.lotsApplied}
                                  </td>
                                  <td className="py-2 px-3 text-right text-purple-600 font-semibold">
                                    RM{" "}
                                    {details.capitalUsedToApply.toLocaleString()}
                                  </td>
                                  {hasAllocationData && (
                                    <>
                                      <td className="py-2 px-3 text-center">
                                        {p.gotAllocation ? (
                                          <span className="bg-green-200 px-2 py-1 rounded text-xs">
                                            ✓ Got
                                          </span>
                                        ) : (
                                          <span className="bg-yellow-200 px-2 py-1 rounded text-xs">
                                            No
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-right font-medium text-green-600">
                                        {p.gotAllocation
                                          ? p.lotsAllocated
                                          : "-"}
                                      </td>
                                      <td className="py-2 px-3 text-right font-medium text-blue-600">
                                        {p.gotAllocation &&
                                        Number(p.sellingPrice) > 0
                                          ? `RM ${Number(
                                              p.sellingPrice
                                            ).toFixed(2)}`
                                          : "-"}
                                      </td>
                                    </>
                                  )}
                                  {hasSellingPrice && (
                                    <td
                                      className={`py-2 px-3 text-right font-bold ${
                                        details.profitLoss >= 0
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {p.gotAllocation &&
                                      Number(p.sellingPrice) > 0
                                        ? `RM ${details.profitLoss.toFixed(2)}`
                                        : "-"}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {participants.filter((p) => !p.willApply).length > 0 && (
                      <div className="mt-3 text-sm text-gray-600">
                        <strong>Capital Only (Not Applying):</strong>{" "}
                        {participants
                          .filter((p) => !p.willApply)
                          .map((p) => p.name)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "participants" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Participants Management
                  </h2>
                  <button
                    onClick={addParticipant}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <PlusCircle className="w-5 h-5" />
                    Add Participant
                  </button>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">How to fill:</p>
                      <p>
                        1. Enter name and initial capital for all participants
                      </p>
                      <p>
                        2. Uncheck "Will Apply" for those who only provide
                        capital
                      </p>
                      <p>
                        3. Enter lots applied manually OR click "Max" button to
                        use all available capital
                      </p>
                      <p>
                        4. After allocation results: Check "Got Allocation" and
                        enter lots allocated
                      </p>
                      <p>
                        5. After selling: Enter each person's selling price and
                        selling fee (brokerage charges)
                      </p>
                      <p>
                        6. Net Profit auto-calculates: Gross Profit - Selling
                        Fee
                      </p>
                      <p className="mt-2 text-xs bg-blue-100 p-2 rounded">
                        💡 <strong>Max Button:</strong> Calculates maximum lots
                        based on: Initial Capital ÷ (IPO Price × Lot Size)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-max">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-3 py-2 text-left font-semibold">
                          Name
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Initial Capital
                        </th>
                        <th className="border px-3 py-2 text-center font-semibold">
                          Will Apply?
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Lots Applied
                        </th>
                        <th className="border px-3 py-2 text-center font-semibold">
                          Use All Capital
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Capital Used
                        </th>
                        <th className="border px-3 py-2 text-center font-semibold">
                          Got Allocation?
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Lots Allocated
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Allocated Amount
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Selling Price (per share)
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Selling Fee (RM)
                        </th>
                        <th className="border px-3 py-2 text-right font-semibold">
                          Net Profit/Loss
                        </th>
                        <th className="border px-3 py-2 text-center font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => {
                        const details = calculateParticipantDetails(p);
                        const maxLots = calculateMaxLots(
                          p.initialCapital,
                          ipoDetails.ipoPrice,
                          ipoDetails.lotSize
                        );
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="border px-3 py-2">
                              <input
                                type="text"
                                value={p.name}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "name",
                                    e.target.value
                                  )
                                }
                                className="w-32 px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                value={p.initialCapital}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "initialCapital",
                                    e.target.value
                                  )
                                }
                                className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.willApply}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "willApply",
                                    e.target.checked
                                  )
                                }
                                className="w-5 h-5 text-indigo-600 rounded"
                              />
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                value={p.lotsApplied}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "lotsApplied",
                                    e.target.value
                                  )
                                }
                                disabled={!p.willApply}
                                className="w-20 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                              />
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <button
                                onClick={() => applyMaxLots(p.id)}
                                disabled={
                                  !p.willApply ||
                                  !ipoDetails.ipoPrice ||
                                  !ipoDetails.lotSize
                                }
                                className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                title={`Max: ${maxLots} lots`}
                              >
                                Max ({maxLots})
                              </button>
                            </td>
                            <td className="border px-3 py-2 text-right text-sm text-gray-600">
                              {details.capitalUsedToApply.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.gotAllocation}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "gotAllocation",
                                    e.target.checked
                                  )
                                }
                                disabled={!p.willApply}
                                className="w-5 h-5 text-green-600 rounded disabled:opacity-50"
                              />
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                value={p.lotsAllocated}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "lotsAllocated",
                                    e.target.value
                                  )
                                }
                                disabled={!p.gotAllocation}
                                className="w-20 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                              />
                            </td>
                            <td className="border px-3 py-2 text-right text-sm text-gray-600">
                              {details.allocatedAmount.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={p.sellingPrice}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "sellingPrice",
                                    e.target.value
                                  )
                                }
                                disabled={!p.gotAllocation}
                                className="w-20 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="border px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={p.sellingFee}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "sellingFee",
                                    e.target.value
                                  )
                                }
                                disabled={!p.gotAllocation}
                                className="w-20 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                                placeholder="0.00"
                              />
                            </td>
                            <td
                              className={`border px-3 py-2 text-right font-semibold ${
                                details.profitLoss >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {details.profitLoss.toFixed(2)}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              {participants.length > 1 && (
                                <button
                                  onClick={() => removeParticipant(p.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <MinusCircle className="w-5 h-5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "transfers" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Fund Transfers (Tier Matching)
                  </h2>
                  <button
                    onClick={addTransfer}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    disabled={participants.length < 2}
                  >
                    <PlusCircle className="w-5 h-5" />
                    Add Transfer
                  </button>
                </div>

                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No transfers recorded. Add a transfer to track fund
                    movements for tier matching between participants.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transfers.map((t) => (
                      <div
                        key={t.id}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              From
                            </label>
                            <select
                              value={t.from}
                              onChange={(e) =>
                                updateTransfer(
                                  t.id,
                                  "from",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                              {participants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              To
                            </label>
                            <select
                              value={t.to}
                              onChange={(e) =>
                                updateTransfer(
                                  t.id,
                                  "to",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                              {participants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Amount
                            </label>
                            <input
                              type="number"
                              value={t.amount}
                              onChange={(e) =>
                                updateTransfer(t.id, "amount", e.target.value)
                              }
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Reason
                            </label>
                            <input
                              type="text"
                              value={t.reason}
                              onChange={(e) =>
                                updateTransfer(t.id, "reason", e.target.value)
                              }
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              placeholder="Tier matching"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={() => removeTransfer(t.id)}
                              className="text-red-600 hover:text-red-700 p-2"
                            >
                              <MinusCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div>
                {!canShowDistribution ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      Distribution Not Available Yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {!hasAllocationData &&
                        "Mark who got allocation in Participants tab first."}
                      {hasAllocationData &&
                        !hasSellingPrice &&
                        "Enter selling prices for participants who got allocation in Participants tab."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 mb-6">
                      <h2 className="text-2xl font-bold mb-2">
                        {ipoDetails.name || "IPO"} - Profit Distribution
                      </h2>
                      <div className="text-sm opacity-90">
                        {ipoDetails.applicationDate && (
                          <span>
                            Applied:{" "}
                            {new Date(
                              ipoDetails.applicationDate
                            ).toLocaleDateString()}{" "}
                            •{" "}
                          </span>
                        )}
                        <span>
                          IPO Price: RM {Number(ipoDetails.ipoPrice).toFixed(2)}{" "}
                          •{" "}
                        </span>
                        <span>
                          Total Pool: RM {totalCapital.toLocaleString()} •{" "}
                        </span>
                        <span>
                          Total Profit: RM {totalProfitLoss.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                      <h3 className="font-semibold text-blue-900 mb-3">
                        📊 Distribution Formula Applied:
                      </h3>
                      {onlyCapitalProviders.length === 0 ? (
                        <div className="text-sm text-blue-800 space-y-2">
                          <p className="font-semibold">
                            ✓ Scenario 1: Everyone applies with CDS
                          </p>
                          <div className="bg-white rounded p-3 space-y-1">
                            <p>
                              • <strong>Total Profit:</strong> RM{" "}
                              {totalProfitLoss.toFixed(2)}
                            </p>
                            <p>
                              • <strong>10% Bonus Pool:</strong> RM{" "}
                              {(totalProfitLoss * 0.1).toFixed(2)} ÷{" "}
                              {whoGotAllocation.length} winners ={" "}
                              <span className="font-semibold">
                                RM{" "}
                                {(
                                  (totalProfitLoss * 0.1) /
                                  whoGotAllocation.length
                                ).toFixed(2)}{" "}
                                per winner
                              </span>
                            </p>
                            <p>
                              • <strong>90% Main Pool:</strong> RM{" "}
                              {(totalProfitLoss * 0.9).toFixed(2)} distributed
                              by capital %
                            </p>
                          </div>
                          <p className="text-xs italic mt-2">
                            Each winner gets: (Capital % × 90% pool) + Bonus
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-blue-800 space-y-2">
                          <p className="font-semibold">
                            ✓ Scenario 2: Some only provide capital
                          </p>
                          <div className="bg-white rounded p-3 space-y-1">
                            <p>
                              • <strong>Total Profit:</strong> RM{" "}
                              {totalProfitLoss.toFixed(2)}
                            </p>
                            <p>
                              • <strong>30% Applier Bonus:</strong> RM{" "}
                              {(totalProfitLoss * 0.3).toFixed(2)} ÷{" "}
                              {whoApplied.length} appliers ={" "}
                              <span className="font-semibold">
                                RM{" "}
                                {(
                                  (totalProfitLoss * 0.3) /
                                  whoApplied.length
                                ).toFixed(2)}{" "}
                                per applier
                              </span>
                            </p>
                            <p>
                              • <strong>70% Capital Pool:</strong> RM{" "}
                              {(totalProfitLoss * 0.7).toFixed(2)} distributed
                              by capital %
                            </p>
                          </div>
                          <p className="text-xs italic mt-2">
                            Appliers get: (Capital % × 70% pool) + Applier bonus
                            <br />
                            Capital-only get: (Capital % × 70% pool)
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
                      <h3 className="font-semibold text-purple-900 mb-2">
                        📋 Understanding the Table:
                      </h3>
                      <div className="text-sm text-purple-800 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <p>
                            • <strong>Selling Price:</strong> Individual selling
                            price per share (can differ by person)
                          </p>
                          <p>
                            • <strong>Selling Fee:</strong> Brokerage charges
                            deducted from gross profit
                          </p>
                          <p>
                            • <strong>Actual Profit Received:</strong> Net money
                            received (Gross Profit - Selling Fee)
                          </p>
                          <p>
                            • <strong>Your Profit Share:</strong> Your
                            calculated portion based on capital % and rules
                          </p>
                          <p>
                            • <strong>Settlement Transfer Out:</strong> Amount
                            those with allocation must transfer to others
                          </p>
                          <p>
                            • <strong>Settlement Transfer In:</strong> Amount
                            you receive from those who got allocation
                          </p>
                        </div>
                        <div>
                          <p>
                            • <strong>Tier Matching Return:</strong> Return
                            borrowed funds for tier matching
                          </p>
                          <p>
                            • <strong>Final Amount:</strong> What you keep after
                            all transfers
                          </p>
                          <p>
                            • <strong>Profit on Capital ROI:</strong> Return %
                            based on your total capital contributed
                          </p>
                          <p>
                            • <strong>Normal ROI:</strong> Return % based on
                            actual capital used for this IPO
                          </p>
                          <p className="mt-2 text-xs italic bg-purple-100 p-2 rounded">
                            💡 ROI perspectives: Profit on Capital shows overall
                            return, Normal ROI shows IPO-specific efficiency
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto mb-6">
                      <div className="bg-indigo-600 text-white px-4 py-3 font-bold text-lg mb-0 rounded-t-lg">
                        📊 {ipoDetails.name || "IPO"} - Distribution Table
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-3 py-2 text-left font-semibold">
                              Name
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Capital
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Capital %
                            </th>
                            <th className="border px-3 py-2 text-center font-semibold">
                              Status
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Selling Price
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Selling Fee
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Actual Profit Received
                            </th>
                            <th className="border px-3 py-2 text-left font-semibold">
                              Formula Breakdown
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Your Profit Share
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Settlement Transfer Out
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Settlement Transfer In
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Tier Matching Return
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Final Amount
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Profit on Capital ROI
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Normal ROI
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {distribution.map((p) => {
                            let formulaBreakdown = "";
                            if (onlyCapitalProviders.length === 0) {
                              const mainPoolShare =
                                (p.capitalPercent / 100) *
                                (totalProfitLoss * 0.9);
                              const bonus = p.gotAllocation
                                ? (totalProfitLoss * 0.1) /
                                  whoGotAllocation.length
                                : 0;
                              formulaBreakdown = `(${p.capitalPercent.toFixed(
                                1
                              )}% × RM ${(totalProfitLoss * 0.9).toFixed(2)})${
                                bonus > 0
                                  ? ` + RM ${bonus.toFixed(2)} bonus`
                                  : ""
                              }`;
                            } else {
                              const capitalPoolShare =
                                (p.capitalPercent / 100) *
                                (totalProfitLoss * 0.7);
                              const applierBonus = p.willApply
                                ? (totalProfitLoss * 0.3) / whoApplied.length
                                : 0;
                              formulaBreakdown = `(${p.capitalPercent.toFixed(
                                1
                              )}% × RM ${(totalProfitLoss * 0.7).toFixed(2)})${
                                applierBonus > 0
                                  ? ` + RM ${applierBonus.toFixed(
                                      2
                                    )} applier bonus`
                                  : ""
                              }`;
                            }

                            // ROI Calculations
                            const profitOnCapitalROI =
                              Number(p.initialCapital) > 0
                                ? (p.netPosition / Number(p.initialCapital)) *
                                  100
                                : 0;
                            const normalROI =
                              p.capitalUsedToApply > 0
                                ? (p.netPosition / p.capitalUsedToApply) * 100
                                : 0;

                            return (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="border px-3 py-2 font-medium">
                                  {p.name}
                                </td>
                                <td className="border px-3 py-2 text-right">
                                  RM {Number(p.initialCapital).toLocaleString()}
                                </td>
                                <td className="border px-3 py-2 text-right font-medium">
                                  {p.capitalPercent.toFixed(2)}%
                                </td>
                                <td className="border px-3 py-2 text-center text-xs">
                                  {!p.willApply && (
                                    <span className="bg-gray-200 px-2 py-1 rounded">
                                      Capital Only
                                    </span>
                                  )}
                                  {p.willApply && !p.gotAllocation && (
                                    <span className="bg-yellow-200 px-2 py-1 rounded">
                                      Applied
                                    </span>
                                  )}
                                  {p.gotAllocation && (
                                    <span className="bg-green-200 px-2 py-1 rounded">
                                      Got {p.lotsAllocated} lots ✓
                                    </span>
                                  )}
                                </td>
                                <td className="border px-3 py-2 text-right text-blue-600 font-medium">
                                  {p.gotAllocation && Number(p.sellingPrice) > 0
                                    ? `RM ${Number(p.sellingPrice).toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-red-600 text-xs">
                                  {p.gotAllocation && Number(p.sellingFee) > 0
                                    ? `-RM ${Number(p.sellingFee).toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right font-semibold text-blue-600">
                                  {p.gotAllocation
                                    ? `RM ${p.actualProfitReceived.toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-xs text-gray-700 font-mono bg-gray-50">
                                  {formulaBreakdown}
                                </td>
                                <td className="border px-3 py-2 text-right text-green-600 font-bold">
                                  RM {p.profitShare.toFixed(2)}
                                </td>
                                <td className="border px-3 py-2 text-right text-red-600 font-semibold">
                                  {p.settlementTransferOut > 0
                                    ? `-RM ${p.settlementTransferOut.toFixed(
                                        2
                                      )}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-green-600 font-semibold">
                                  {p.settlementTransferIn > 0
                                    ? `+RM ${p.settlementTransferIn.toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-gray-600">
                                  {p.tierMatchingTransferIn > 0 &&
                                    `+RM ${p.tierMatchingTransferIn.toFixed(
                                      2
                                    )}`}
                                  {p.tierMatchingTransferOut > 0 &&
                                    `-RM ${p.tierMatchingTransferOut.toFixed(
                                      2
                                    )}`}
                                  {p.tierMatchingTransferIn === 0 &&
                                    p.tierMatchingTransferOut === 0 &&
                                    "-"}
                                </td>
                                <td className="border px-3 py-2 text-right font-bold text-base">
                                  <span
                                    className={
                                      p.netPosition >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    RM {p.netPosition.toFixed(2)}
                                  </span>
                                </td>
                                <td className="border px-3 py-2 text-right font-bold">
                                  <span
                                    className={
                                      profitOnCapitalROI >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {profitOnCapitalROI.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="border px-3 py-2 text-right font-bold">
                                  <span
                                    className={
                                      normalROI >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {p.capitalUsedToApply > 0
                                      ? `${normalROI.toFixed(2)}%`
                                      : "-"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td className="border px-3 py-2">TOTAL</td>
                            <td className="border px-3 py-2 text-right">
                              RM {totalCapital.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2 text-right">
                              100%
                            </td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2 text-right text-red-600 text-xs">
                              -RM{" "}
                              {distribution
                                .reduce(
                                  (sum, p) => sum + Number(p.sellingFee || 0),
                                  0
                                )
                                .toFixed(2)}
                            </td>
                            <td className="border px-3 py-2 text-right text-blue-600">
                              RM{" "}
                              {distribution
                                .reduce(
                                  (sum, p) => sum + p.actualProfitReceived,
                                  0
                                )
                                .toFixed(2)}
                            </td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2 text-right text-green-600">
                              RM{" "}
                              {distribution
                                .reduce((sum, p) => sum + p.profitShare, 0)
                                .toFixed(2)}
                            </td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2 text-right text-base">
                              RM{" "}
                              {distribution
                                .reduce((sum, p) => sum + p.netPosition, 0)
                                .toFixed(2)}
                            </td>
                            <td className="border px-3 py-2 text-right">
                              <span
                                className={
                                  totalProfitLoss >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {totalCapital > 0
                                  ? `${(
                                      (distribution.reduce(
                                        (sum, p) => sum + p.netPosition,
                                        0
                                      ) /
                                        totalCapital) *
                                      100
                                    ).toFixed(2)}%`
                                  : "-"}
                              </span>
                            </td>
                            <td className="border px-3 py-2 text-right">
                              <span
                                className={
                                  totalProfitLoss >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {totalCapitalUsed > 0
                                  ? `${(
                                      (distribution.reduce(
                                        (sum, p) => sum + p.netPosition,
                                        0
                                      ) /
                                        totalCapitalUsed) *
                                      100
                                    ).toFixed(2)}%`
                                  : "-"}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="p-5 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg">
                      <h3 className="font-bold text-yellow-900 mb-3 text-lg flex items-center gap-2">
                        💰 Settlement Instructions (Transfers to Make)
                      </h3>

                      <div className="bg-white rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Step 1: Settlement Transfers (Profit Distribution)
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Those who got allocation must transfer profit shares
                          to others:
                        </p>
                        <div className="space-y-2">
                          {distribution
                            .filter((p) => p.settlementTransferOut > 0)
                            .map((payer) => {
                              const receivers = distribution.filter(
                                (r) => r.settlementTransferIn > 0
                              );
                              return receivers.map((receiver) => {
                                const amount =
                                  (receiver.profitShare /
                                    distribution.reduce(
                                      (sum, p) =>
                                        sum + (p.settlementTransferIn || 0),
                                      0
                                    )) *
                                  payer.settlementTransferOut;
                                if (amount > 0.01) {
                                  return (
                                    <div
                                      key={`${payer.id}-${receiver.id}`}
                                      className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"
                                    >
                                      <div className="flex-1">
                                        <span className="font-bold text-red-700">
                                          {payer.name}
                                        </span>
                                        <span className="mx-2 text-gray-600">
                                          transfers profit to
                                        </span>
                                        <span className="font-bold text-green-700">
                                          {receiver.name}
                                        </span>
                                      </div>
                                      <div className="font-bold text-lg text-indigo-600">
                                        RM {amount.toFixed(2)}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              });
                            })}
                          {distribution.every(
                            (p) => p.settlementTransferOut === 0
                          ) && (
                            <p className="text-gray-500 text-center py-2">
                              No settlement transfers needed (all profits
                              retained by recipients)
                            </p>
                          )}
                        </div>
                      </div>

                      {transfers.length > 0 && (
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3">
                            Step 2: Return Tier Matching Funds
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Return borrowed funds used for tier matching:
                          </p>
                          <div className="space-y-2">
                            {transfers.map((t) => {
                              const from = participants.find(
                                (p) => p.id === t.from
                              );
                              const to = participants.find(
                                (p) => p.id === t.to
                              );
                              return (
                                <div
                                  key={t.id}
                                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <span className="font-bold text-red-700">
                                      {to?.name}
                                    </span>
                                    <span className="mx-2 text-gray-600">
                                      returns to
                                    </span>
                                    <span className="font-bold text-green-700">
                                      {from?.name}
                                    </span>
                                  </div>
                                  <div className="font-bold text-lg text-gray-600">
                                    RM {Number(t.amount).toFixed(2)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2">
                          Final Summary - What Each Person Keeps:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {distribution.map((p) => (
                            <div
                              key={p.id}
                              className="flex justify-between items-center p-2 bg-white rounded"
                            >
                              <span className="font-medium text-gray-800">
                                {p.name}
                              </span>
                              <span
                                className={`font-bold ${
                                  p.netPosition >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                RM {p.netPosition.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* How This Works - Moved to bottom */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">
                        📊 How This Works:
                      </h3>
                      <p className="text-blue-800 text-sm mb-2">
                        • <strong>Capital Share:</strong> Your percentage of
                        total pool capital
                      </p>
                      <p className="text-blue-800 text-sm mb-2">
                        • <strong>Profit Share:</strong> Your share of total
                        profit/loss based on capital contribution
                      </p>
                      <p className="text-blue-800 text-sm mb-2">
                        • <strong>Final Amount:</strong> Your initial capital +
                        profit share
                      </p>
                      <p className="text-blue-800 text-sm mb-2">
                        • <strong>Profit on Capital ROI:</strong> Profit
                        percentage based on total capital contributed to the
                        pool
                      </p>
                      <p className="text-blue-800 text-sm">
                        • <strong>Normal ROI:</strong> Profit percentage based
                        on capital used for IPO application (only for those who
                        applied)
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

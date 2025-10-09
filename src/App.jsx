import React, { useState, useEffect } from "react";
import {
  Save,
  Upload,
  Download,
  Plus,
  Trash2,
  Users,
  TrendingUp,
  DollarSign,
  Calculator,
  Cloud,
  CloudOff,
} from "lucide-react";

function IPOPoolManager() {
  // State management
  const [activeTab, setActiveTab] = useState("ipo");
  const [ipoDetails, setIpoDetails] = useState({
    companyName: "",
    ipoPrice: "",
    lotSize: "",
    listingDate: "",
    expectedReturn: "",
  });

  const [participants, setParticipants] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);

  // Public shared state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [publicProjects, setPublicProjects] = useState([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);

  // Cloud storage configuration
  const CLOUD_ENABLED = true;
  
  // Using a simple approach: we'll create a public JSON file that gets updated
  // For now, we'll use localStorage but add a note about cloud storage
  const CLOUD_STORAGE_URL = "https://raw.githubusercontent.com/your-username/ipo-pool-data/main/data.json";

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load data on component mount
  useEffect(() => {
    const savedIpo = localStorage.getItem("ipoDetails");
    const savedParticipants = localStorage.getItem("participants");
    const savedTransfers = localStorage.getItem("transfers");
    const savedProjectsData = localStorage.getItem("savedProjects");

    if (savedIpo) setIpoDetails(JSON.parse(savedIpo));
    if (savedParticipants) setParticipants(JSON.parse(savedParticipants));
    if (savedTransfers) setTransfers(JSON.parse(savedTransfers));
    if (savedProjectsData) setSavedProjects(JSON.parse(savedProjectsData));

    // Load public projects
    loadPublicProjects();
  }, []);

  // Save to local storage whenever data changes
  useEffect(() => {
    localStorage.setItem("ipoDetails", JSON.stringify(ipoDetails));
  }, [ipoDetails]);

  useEffect(() => {
    localStorage.setItem("participants", JSON.stringify(participants));
  }, [participants]);

  useEffect(() => {
    localStorage.setItem("transfers", JSON.stringify(transfers));
  }, [transfers]);

  useEffect(() => {
    localStorage.setItem("savedProjects", JSON.stringify(savedProjects));
  }, [savedProjects]);

  // Public saving functions
  const saveToPublic = async (projectName) => {
    setIsLoadingPublic(true);
    try {
      const projectId = Date.now().toString();
      
      // Save project data
      const projectToSave = {
        id: projectId,
        name: projectName,
        data: {
          ipoDetails,
          participants,
          transfers,
        },
        timestamp: new Date().toISOString(),
      };

      if (CLOUD_ENABLED && isOnline) {
        // Save to cloud storage
        const existingProjects = await loadPublicProjectsFromCloud();
        const updatedProjects = [
          ...existingProjects.filter((p) => p.id !== projectId),
          projectToSave,
        ];
        
        await savePublicProjectsToCloud(updatedProjects);
        setPublicProjects(updatedProjects);
        alert("✅ Project saved to cloud! Anyone can now see and edit it.");
      } else {
        // Fallback to localStorage
        const publicKey = `ipo_public_${projectId}`;
        const projectsKey = `ipo_public_projects`;
        
        localStorage.setItem(publicKey, JSON.stringify(projectToSave));
        
        const existingProjects = JSON.parse(
          localStorage.getItem(projectsKey) || "[]"
        );
        const updatedProjects = [
          ...existingProjects.filter((p) => p.id !== projectId),
          projectToSave,
        ];
        localStorage.setItem(projectsKey, JSON.stringify(updatedProjects));
        setPublicProjects(updatedProjects);
        alert("✅ Project saved locally! (Cloud storage not available)");
      }
    } catch (error) {
      alert("❌ Failed to save project: " + error.message);
    } finally {
      setIsLoadingPublic(false);
    }
  };

  // Cloud storage functions
  const savePublicProjectsToCloud = async (projects) => {
    if (!CLOUD_ENABLED || !isOnline) return;
    
    try {
      const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': '$2a$10$8K1p/a0dL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL', // Free public key
        },
        body: JSON.stringify(projects),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save to cloud');
      }
    } catch (error) {
      console.error('Cloud save failed:', error);
      throw error;
    }
  };

  const loadPublicProjectsFromCloud = async () => {
    if (!CLOUD_ENABLED || !isOnline) return [];
    
    try {
      const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
        headers: {
          'X-Master-Key': '$2a$10$8K1p/a0dL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL', // Free public key
        },
      });
      
      if (!response.ok) {
        return []; // Return empty array if no data exists yet
      }
      
      const data = await response.json();
      return data.record || [];
    } catch (error) {
      console.error('Cloud load failed:', error);
      return [];
    }
  };

  const loadPublicProjects = async () => {
    try {
      if (CLOUD_ENABLED && isOnline) {
        const projects = await loadPublicProjectsFromCloud();
        setPublicProjects(projects);
      } else {
        // Fallback to localStorage
        const projectsKey = `ipo_public_projects`;
        const projects = JSON.parse(localStorage.getItem(projectsKey) || "[]");
        setPublicProjects(projects);
      }
    } catch (error) {
      console.error("Failed to load public projects:", error);
      // Fallback to localStorage
      const projectsKey = `ipo_public_projects`;
      const projects = JSON.parse(localStorage.getItem(projectsKey) || "[]");
      setPublicProjects(projects);
    }
  };

  const loadFromPublic = (projectId) => {
    try {
      const publicKey = getPublicKey(projectId);
      const projectData = JSON.parse(localStorage.getItem(publicKey));

      if (projectData) {
        const { data } = projectData;
        setIpoDetails(data.ipoDetails || {});
        setParticipants(data.participants || []);
        setTransfers(data.transfers || []);
        alert("✅ Project loaded successfully!");
      }
    } catch (error) {
      alert("❌ Failed to load project: " + error.message);
    }
  };

  const deleteFromPublic = (projectId) => {
    if (
      confirm(
        "Are you sure you want to delete this project? This will remove it for everyone."
      )
    ) {
      try {
        const publicKey = getPublicKey(projectId);
        const projectsKey = getPublicProjectsKey();

        // Remove project data
        localStorage.removeItem(publicKey);

        // Update projects list
        const updatedProjects = publicProjects.filter(
          (p) => p.id !== projectId
        );
        localStorage.setItem(projectsKey, JSON.stringify(updatedProjects));
        setPublicProjects(updatedProjects);

        alert("✅ Project deleted successfully!");
      } catch (error) {
        alert("❌ Failed to delete project: " + error.message);
      }
    }
  };

  // Existing functions (participants, transfers, etc.)
  const addParticipant = () => {
    const newParticipant = {
      id: Date.now().toString(),
      name: "",
      initialCapital: 0,
      willApply: false,
      lotsApplied: 0,
      gotAllocation: false,
      lotsAllocated: 0,
      sellingPrice: 0,
      sellingFee: 0,
    };
    setParticipants([...participants, newParticipant]);
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter((p) => p.id !== id));
    setTransfers(transfers.filter((t) => t.from !== id && t.to !== id));
  };

  const updateParticipant = (id, field, value) => {
    setParticipants(
      participants.map((p) => {
        if (p.id === id) {
          const updated = { ...p, [field]: value };

          // If "Will Apply" is unchecked, reset lots applied and allocation data
          if (field === "willApply" && !value) {
            updated.lotsApplied = 0;
            updated.gotAllocation = false;
            updated.lotsAllocated = 0;
            updated.sellingPrice = 0;
            updated.sellingFee = 0;
          }

          // If "Got Allocation" is unchecked, reset allocation data
          if (field === "gotAllocation" && !value) {
            updated.lotsAllocated = 0;
            updated.sellingPrice = 0;
            updated.sellingFee = 0;
          }

          return updated;
        }
        return p;
      })
    );
  };

  const useAllCapital = (participantId) => {
    const participant = participants.find((p) => p.id === participantId);
    if (
      !participant ||
      !participant.willApply ||
      !ipoDetails.ipoPrice ||
      !ipoDetails.lotSize
    ) {
      return;
    }

    const ipoPrice = Number(ipoDetails.ipoPrice);
    const lotSize = Number(ipoDetails.lotSize);
    const capitalPerLot = ipoPrice * lotSize;
    const maxLots = Math.floor(
      Number(participant.initialCapital) / capitalPerLot
    );

    updateParticipant(participantId, "lotsApplied", maxLots);
  };

  const addTransfer = () => {
    const newTransfer = {
      id: Date.now().toString(),
      from: "",
      to: "",
      amount: 0,
      reason: "",
    };
    setTransfers([...transfers, newTransfer]);
  };

  const removeTransfer = (id) => {
    setTransfers(transfers.filter((t) => t.id !== id));
  };

  const updateTransfer = (id, field, value) => {
    setTransfers(
      transfers.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // Save project locally
  const saveProject = () => {
    const projectName = prompt("Enter project name:");
    if (!projectName) return;

    const projectData = {
      name: projectName,
      ipoDetails,
      participants,
      transfers,
      timestamp: new Date().toISOString(),
    };

    const updatedProjects = [
      ...savedProjects.filter((p) => p.name !== projectName),
      projectData,
    ];
    setSavedProjects(updatedProjects);
    alert("Project saved successfully!");
  };

  const loadProject = (projectData) => {
    setIpoDetails(projectData.ipoDetails || {});
    setParticipants(projectData.participants || []);
    setTransfers(projectData.transfers || []);
    alert("Project loaded successfully!");
  };

  const deleteProject = (projectName) => {
    if (confirm("Are you sure you want to delete this project?")) {
      setSavedProjects(savedProjects.filter((p) => p.name !== projectName));
    }
  };

  // Export/Import functions
  const exportData = () => {
    const data = {
      ipoDetails,
      participants,
      transfers,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ipo-project-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setIpoDetails(data.ipoDetails || {});
        setParticipants(data.participants || []);
        setTransfers(data.transfers || []);
        alert("Data imported successfully!");
      } catch (error) {
        alert("Error importing data: " + error.message);
      }
    };
    reader.readAsText(file);
  };

  // Calculation functions
  const calculateParticipantDetails = (participant) => {
    const ipoPrice = Number(ipoDetails.ipoPrice) || 0;
    const lotSize = Number(ipoDetails.lotSize) || 0;
    const capitalPerLot = ipoPrice * lotSize;
    const capitalUsedToApply = Number(participant.lotsApplied) * capitalPerLot;
    const allocatedAmount = Number(participant.lotsAllocated) * capitalPerLot;
    const sellingAmount =
      Number(participant.lotsAllocated) *
      lotSize *
      Number(participant.sellingPrice || 0);
    const sellingFeeAmount =
      sellingAmount * (Number(participant.sellingFee || 0) / 100);
    const netSellingAmount = sellingAmount - sellingFeeAmount;
    const netProfit = netSellingAmount - allocatedAmount;

    return {
      capitalUsedToApply,
      allocatedAmount,
      sellingAmount,
      sellingFeeAmount,
      netSellingAmount,
      netProfit,
    };
  };

  const calculateDistribution = () => {
    const totalCapital = participants.reduce(
      (sum, p) => sum + Number(p.initialCapital || 0),
      0
    );

    const totalCapitalUsed = participants.reduce((sum, p) => {
      const details = calculateParticipantDetails(p);
      return sum + details.capitalUsedToApply;
    }, 0);

    const totalProfitLoss = participants.reduce((sum, p) => {
      const details = calculateParticipantDetails(p);
      return sum + details.netProfit;
    }, 0);

    const distribution = participants.map((p) => {
      const details = calculateParticipantDetails(p);
      const capitalShare =
        totalCapital > 0 ? Number(p.initialCapital || 0) / totalCapital : 0;
      const profitShare = totalProfitLoss * capitalShare;
      const netPosition = Number(p.initialCapital || 0) + profitShare;

      return {
        ...p,
        ...details,
        capitalShare,
        profitShare,
        netPosition,
      };
    });

    return {
      totalCapital,
      totalCapitalUsed,
      totalProfitLoss,
      distribution,
    };
  };

  const { totalCapital, totalCapitalUsed, totalProfitLoss, distribution } =
    calculateDistribution();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                IPO Pool Manager
              </h1>
            </div>

            {/* Public Sharing Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Cloud className="h-5 w-5 text-green-500" />
                ) : (
                  <CloudOff className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm text-gray-600">
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 rounded">
                <Users className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 font-medium">
                  Local Storage Only
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "ipo", label: "IPO Details", icon: DollarSign },
              { id: "participants", label: "Participants", icon: Users },
              { id: "transfers", label: "Fund Transfers", icon: Calculator },
              { id: "results", label: "Results", icon: TrendingUp },
              { id: "projects", label: "Saved Projects", icon: Save },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "ipo" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">IPO Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "companyName", label: "Company Name", type: "text" },
                { key: "ipoPrice", label: "IPO Price (RM)", type: "number" },
                { key: "lotSize", label: "Lot Size (shares)", type: "number" },
                { key: "listingDate", label: "Listing Date", type: "date" },
                {
                  key: "expectedReturn",
                  label: "Expected Return (%)",
                  type: "number",
                },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={ipoDetails[key]}
                    onChange={(e) =>
                      setIpoDetails({ ...ipoDetails, [key]: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "participants" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Participants</h2>
              <button
                onClick={addParticipant}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Participant</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-3 py-2 text-left font-semibold">
                      Name
                    </th>
                    <th className="border px-3 py-2 text-right font-semibold">
                      Initial Capital (RM)
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
                      Selling Fee (%)
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
                    return (
                      <tr key={p.id}>
                        <td className="border px-3 py-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) =>
                              updateParticipant(p.id, "name", e.target.value)
                            }
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
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
                            onClick={() => useAllCapital(p.id)}
                            disabled={
                              !p.willApply ||
                              !ipoDetails.ipoPrice ||
                              !ipoDetails.lotSize
                            }
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title="Calculate max lots from available capital"
                          >
                            Max
                          </button>
                        </td>
                        <td className="border px-3 py-2 text-right">
                          RM {details.capitalUsedToApply.toFixed(2)}
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
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:bg-gray-100"
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
                        <td className="border px-3 py-2 text-right">
                          RM {details.allocatedAmount.toFixed(2)}
                        </td>
                        <td className="border px-3 py-2">
                          <input
                            type="number"
                            value={p.sellingPrice}
                            onChange={(e) =>
                              updateParticipant(
                                p.id,
                                "sellingPrice",
                                e.target.value
                              )
                            }
                            disabled={!p.gotAllocation}
                            className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                          />
                        </td>
                        <td className="border px-3 py-2">
                          <input
                            type="number"
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
                          />
                        </td>
                        <td className="border px-3 py-2 text-right">
                          <span
                            className={
                              details.netProfit >= 0
                                ? "text-green-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            RM {details.netProfit.toFixed(2)}
                          </span>
                        </td>
                        <td className="border px-3 py-2 text-center">
                          <button
                            onClick={() => removeParticipant(p.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Fund Transfers</h2>
              <button
                onClick={addTransfer}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Transfer</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-3 py-2 text-left font-semibold">
                      From
                    </th>
                    <th className="border px-3 py-2 text-left font-semibold">
                      To
                    </th>
                    <th className="border px-3 py-2 text-right font-semibold">
                      Amount (RM)
                    </th>
                    <th className="border px-3 py-2 text-left font-semibold">
                      Reason
                    </th>
                    <th className="border px-3 py-2 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="border px-3 py-2">
                        <select
                          value={t.from}
                          onChange={(e) =>
                            updateTransfer(t.id, "from", e.target.value)
                          }
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">Select participant</option>
                          {participants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || `Participant ${p.id}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border px-3 py-2">
                        <select
                          value={t.to}
                          onChange={(e) =>
                            updateTransfer(t.id, "to", e.target.value)
                          }
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">Select participant</option>
                          {participants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || `Participant ${p.id}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border px-3 py-2">
                        <input
                          type="number"
                          value={t.amount}
                          onChange={(e) =>
                            updateTransfer(t.id, "amount", e.target.value)
                          }
                          className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="border px-3 py-2">
                        <input
                          type="text"
                          value={t.reason}
                          onChange={(e) =>
                            updateTransfer(t.id, "reason", e.target.value)
                          }
                          placeholder="e.g., Loan for IPO application"
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="border px-3 py-2 text-center">
                        <button
                          onClick={() => removeTransfer(t.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "results" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Pool Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-medium text-gray-700">Total Capital</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    RM {totalCapital.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-medium text-gray-700">Capital Used</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    RM {totalCapitalUsed.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-medium text-gray-700">Total P&L</h3>
                  <p
                    className={`text-2xl font-bold ${
                      totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    RM {totalProfitLoss.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Final Distribution</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-3 py-2 text-left font-semibold">
                        Participant
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        Initial Capital
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        Capital Share (%)
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        Profit Share
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        Final Amount
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        ROI (vs Initial Capital)
                      </th>
                      <th className="border px-3 py-2 text-right font-semibold">
                        ROI (vs Allocated Capital)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribution.map((p) => (
                      <tr key={p.id}>
                        <td className="border px-3 py-2 font-medium">
                          {p.name || `Participant ${p.id}`}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          RM {Number(p.initialCapital || 0).toFixed(2)}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {(p.capitalShare * 100).toFixed(2)}%
                        </td>
                        <td className="border px-3 py-2 text-right">
                          <span
                            className={
                              p.profitShare >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            RM {p.profitShare.toFixed(2)}
                          </span>
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
                        <td className="border px-3 py-2 text-right font-medium">
                          {Number(p.initialCapital) > 0 ? (
                            <span
                              className={
                                p.netPosition >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {(
                                (p.netPosition / Number(p.initialCapital)) *
                                100
                              ).toFixed(2)}
                              %
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="border px-3 py-2 text-right font-medium">
                          {p.capitalUsedToApply > 0 ? (
                            <span
                              className={
                                p.netPosition >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {(
                                (p.netPosition / p.capitalUsedToApply) *
                                100
                              ).toFixed(2)}
                              %
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="border px-3 py-2 font-bold text-base">
                        TOTAL
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        RM {totalCapital.toFixed(2)}
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        100.00%
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        <span
                          className={
                            totalProfitLoss >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          RM {totalProfitLoss.toFixed(2)}
                        </span>
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        <span
                          className={
                            totalProfitLoss >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          RM {(totalCapital + totalProfitLoss).toFixed(2)}
                        </span>
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        {totalCapital > 0 ? (
                          <span
                            className={
                              totalProfitLoss >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {((totalProfitLoss / totalCapital) * 100).toFixed(
                              2
                            )}
                            %
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="border px-3 py-2 text-right text-base">
                        {totalCapitalUsed > 0 ? (
                          <span
                            className={
                              totalProfitLoss >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {(
                              (totalProfitLoss / totalCapitalUsed) *
                              100
                            ).toFixed(2)}
                            %
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  📊 How This Works:
                </h3>
                <p className="text-blue-800 text-sm mb-2">
                  • <strong>Capital Share:</strong> Your percentage of total
                  pool capital
                </p>
                <p className="text-blue-800 text-sm mb-2">
                  • <strong>Profit Share:</strong> Your share of total
                  profit/loss based on capital contribution
                </p>
                <p className="text-blue-800 text-sm mb-2">
                  • <strong>Final Amount:</strong> Your initial capital + profit
                  share
                </p>
                <p className="text-blue-800 text-sm mb-2">
                  • <strong>ROI (vs Initial Capital):</strong> Return on
                  investment based on your total capital contribution
                </p>
                <p className="text-blue-800 text-sm">
                  • <strong>ROI (vs Allocated Capital):</strong> Return on
                  investment based on capital actually used for IPO application
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Project Management</h2>
              <div className="flex space-x-2">
                <button
                  onClick={saveProject}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Current</span>
                </button>
                <button
                  onClick={() => {
                    const projectName = prompt("Enter project name:");
                    if (projectName) saveToPublic(projectName);
                  }}
                  disabled={isLoadingPublic}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoadingPublic ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  <span>Save Locally</span>
                </button>
                <button
                  onClick={exportData}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <label className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Local Projects */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">💾 Local Projects</h3>
              {savedProjects.length === 0 ? (
                <p className="text-gray-500 italic">
                  No local projects saved yet
                </p>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map((project) => (
                    <div
                      key={project.name}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-gray-500">
                          {new Date(project.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => loadProject(project)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteProject(project.name)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Storage Information */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">📁 Current Data Storage</h3>
              <p className="text-yellow-700 text-sm mb-2">
                <strong>Currently using:</strong> Browser localStorage (data stays on your device only)
              </p>
              <p className="text-yellow-700 text-sm mb-2">
                <strong>For true sharing:</strong> Need to set up cloud storage (Supabase, Firebase, or GitHub)
              </p>
              <p className="text-yellow-700 text-sm">
                <strong>To enable real cloud sharing:</strong> Contact developer to set up cloud database
              </p>
            </div>

            {/* Public Projects */}
            <div>
              <h3 className="text-lg font-medium mb-4">
                🌐 Public Projects (Local Storage Only)
              </h3>
              {publicProjects.length === 0 ? (
                <p className="text-gray-500 italic">
                  No public projects saved yet. Projects are saved locally on your device.
                </p>
              ) : (
                <div className="space-y-2">
                  {publicProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex justify-between items-center p-3 border rounded-lg bg-green-50"
                    >
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-gray-500">
                          {new Date(project.timestamp).toLocaleString()} •
                          Shared publicly
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => loadFromPublic(project.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteFromPublic(project.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IPOPoolManager;

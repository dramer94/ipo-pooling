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
  FileInput,
  X,
  Check,
} from "lucide-react";
import { supabase, IPO_PROJECTS_TABLE } from "./supabase";
import { parseIPOText, convertToAppFormat } from "./ipoTextParser";

export default function IPOPoolManager() {
  const [savedProjects, setSavedProjects] = useState(() => {
    // Load saved projects from localStorage on component mount
    const saved = localStorage.getItem("ipo-saved-projects");
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
      actualApplicantName: "",
      lotsApplied: 0,
      gotAllocation: false,
      lotsAllocated: 0,
      sellingPrice: 0,
      sellingFee: 0,
    },
  ]);

  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedIpos, setExpandedIpos] = useState({});
  const [ipoSearch, setIpoSearch] = useState("");
  const [expandedMember, setExpandedMember] = useState(null);
  const [completedSettlements, setCompletedSettlements] = useState([]);

  // Real admin auth via Supabase (works with Row Level Security). Single
  // shared account; the login box only asks for the password, email is fixed.
  const ADMIN_EMAIL = "admin@ifcpo.com.my";
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const authed = !!session;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadPublicProjectsFromCloud();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setPwError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: pwInput,
    });
    if (error) setPwError(error.message || "Wrong password — try again.");
    setLoggingIn(false);
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPwInput("");
  };

  // Import feature states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState("");

  // Load projects from cloud on component mount + subscribe to realtime changes
  useEffect(() => {
    loadPublicProjectsFromCloud();

    const channel = supabase
      .channel('ipo_projects_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ipo_projects' }, () => {
        loadPublicProjectsFromCloud();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Save projects to localStorage whenever savedProjects changes
  useEffect(() => {
    localStorage.setItem("ipo-saved-projects", JSON.stringify(savedProjects));
  }, [savedProjects]);

  // Import functions
  const handleParseText = () => {
    try {
      setParseError("");
      const result = parseIPOText(importText);
      const converted = convertToAppFormat(result);
      setParsedData(converted);
    } catch (error) {
      setParseError(error.message);
      setParsedData(null);
    }
  };

  const handleImportIPO = (ipoData) => {
    // Load the selected IPO data into the current project
    setIpoDetails(ipoData.ipoDetails);
    setParticipants(ipoData.participants);
    setTransfers(ipoData.transfers || []);
    setCurrentProjectId(null); // New project
    setShowImportModal(false);
    setImportText("");
    setParsedData(null);
    setActiveTab("participants");
  };

  const handleImportAllIPOs = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setIsLoading(true);
    let successCount = 0;

    try {
      for (const ipoData of parsedData) {
        const projectData = {
          id: crypto.randomUUID(),
          savedDate: new Date().toISOString(),
          ipoDetails: ipoData.ipoDetails,
          participants: ipoData.participants,
          transfers: ipoData.transfers || [],
        };

        // Save to cloud
        const { error } = await supabase.from(IPO_PROJECTS_TABLE).upsert({
          id: projectData.id,
          name: ipoData.ipoDetails.name,
          ipo_details: projectData.ipoDetails,
          participants: projectData.participants,
          transfers: projectData.transfers,
        });

        if (!error) {
          setSavedProjects((prev) => [...prev, projectData]);
          successCount++;
        }
      }

      setShowImportModal(false);
      setImportText("");
      setParsedData(null);
      alert(`Successfully imported ${successCount} IPO project(s) to cloud!`);
      setActiveTab("ipo");
    } catch (error) {
      console.error("Error bulk importing:", error);
      alert(`Imported ${successCount} out of ${parsedData.length} projects. Some failed.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImport = () => {
    setImportText("");
    setParsedData(null);
    setParseError("");
  };

  // Calculate M+ selling fee
  const calculateMPlusFee = (sellingAmount) => {
    if (!sellingAmount || sellingAmount <= 0) return 0;

    // M+ Fee Structure for selling:
    // 1. Brokerage: 0.1% (minimum RM8)
    const brokerageFee = Math.max(sellingAmount * 0.001, 8);

    // 2. Clearing fee: 0.03%
    const clearingFee = sellingAmount * 0.0003;

    // 3. Stamp duty: RM1 per RM1000 or part thereof (minimum RM1)
    const stampDuty = Math.max(Math.ceil(sellingAmount / 1000), 1);

    // Total fee
    const totalFee = brokerageFee + clearingFee + stampDuty;

    return parseFloat(totalFee.toFixed(2));
  };

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

  // Auto-calculate selling fee when selling price or lots allocated changes
  const updateParticipantWithAutoFee = (id, field, value) => {
    const participant = participants.find((p) => p.id === id);
    if (!participant) return;

    // Update the field first
    const updatedParticipant = { ...participant, [field]: value };

    // Auto-calculate selling fee if relevant fields changed
    if (field === "sellingPrice" || field === "lotsAllocated") {
      const sellingPrice = Number(
        field === "sellingPrice" ? value : participant.sellingPrice
      );
      const lotsAllocated = Number(
        field === "lotsAllocated" ? value : participant.lotsAllocated
      );
      const lotSize = Number(ipoDetails.lotSize);

      if (sellingPrice > 0 && lotsAllocated > 0 && lotSize > 0) {
        const sellingAmount = lotsAllocated * lotSize * sellingPrice;
        updatedParticipant.sellingFee = calculateMPlusFee(sellingAmount);
      }
    }

    setParticipants(
      participants.map((p) => (p.id === id ? updatedParticipant : p))
    );
  };

  const saveCurrentProject = async () => {
    const projectName = ipoDetails.name || "Untitled IPO";

    if (!projectName.trim()) {
      alert("Please enter a project name first!");
      return;
    }

    setIsLoading(true);

    try {
      const projectData = {
        id: currentProjectId || crypto.randomUUID(),
        savedDate: new Date().toISOString(),
        ipoDetails,
        participants,
        transfers,
        completedSettlements,
      };

      // Save to cloud
      const { error } = await supabase.from(IPO_PROJECTS_TABLE).upsert({
        id: projectData.id,
        name: projectName,
        ipo_details: projectData.ipoDetails,
        participants: projectData.participants,
        transfers: projectData.transfers,
        completed_settlements: projectData.completedSettlements,
      });

      if (error) throw error;

      // Update local state
      if (currentProjectId) {
        setSavedProjects(
          savedProjects.map((p) =>
            p.id === currentProjectId ? projectData : p
          )
        );
      } else {
        setSavedProjects([...savedProjects, projectData]);
        setCurrentProjectId(projectData.id);
      }

      alert(`Project "${projectName}" saved to cloud successfully!`);
    } catch (error) {
      console.error("Error saving to cloud:", error);
      alert("Failed to save to cloud. Saving locally instead.");

      // Fallback to local save
      const projectData = {
        id: currentProjectId || crypto.randomUUID(),
        savedDate: new Date().toISOString(),
        ipoDetails,
        participants,
        transfers,
        completedSettlements,
      };

      if (currentProjectId) {
        setSavedProjects(
          savedProjects.map((p) =>
            p.id === currentProjectId ? projectData : p
          )
        );
      } else {
        setSavedProjects([...savedProjects, projectData]);
        setCurrentProjectId(projectData.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = (project) => {
    setIpoDetails(project.ipoDetails);
    setParticipants(project.participants);
    setTransfers(project.transfers);
    setCompletedSettlements(project.completedSettlements || []);
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
        actualApplicantName: "",
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

  const loadPublicProjectsFromCloud = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from(IPO_PROJECTS_TABLE)
        .select("*");

      if (error) throw error;

      const cloudProjects = data
        .map((row) => ({
          id: row.id,
          savedDate: new Date().toISOString(), // Use current time since no timestamp column
          ipoDetails: row.ipo_details,
          participants: row.participants,
          transfers: row.transfers,
          completedSettlements: row.completed_settlements || [],
        }))
        // Skip junk/blank rows (no IPO name or price) so counts stay correct
        .filter(
          (p) =>
            p.ipoDetails &&
            p.ipoDetails.name &&
            p.ipoDetails.name.trim() &&
            Number(p.ipoDetails.ipoPrice) > 0
        );

      setSavedProjects(cloudProjects);
      setIsOnline(true);
    } catch (error) {
      console.error("Error loading from cloud:", error);
      setIsOnline(false);
      // Fallback to localStorage
      const saved = localStorage.getItem("ipo-saved-projects");
      if (saved) {
        setSavedProjects(JSON.parse(saved));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (projectId) => {
    if (confirm("Delete this project permanently?")) {
      try {
        // Delete from cloud
        const { error } = await supabase
          .from(IPO_PROJECTS_TABLE)
          .delete()
          .eq("id", projectId);

        if (error) throw error;

        // Update local state
        setSavedProjects(savedProjects.filter((p) => p.id !== projectId));
        if (currentProjectId === projectId) {
          createNewProject();
        }
      } catch (error) {
        console.error("Error deleting from cloud:", error);
        alert("Failed to delete from cloud, but deleted locally.");

        // Fallback to local delete
        setSavedProjects(savedProjects.filter((p) => p.id !== projectId));
        if (currentProjectId === projectId) {
          createNewProject();
        }
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

  const cleanupDuplicateApplicants = () => {
    const cleaned = savedProjects.map(project => {
      if (!project.participants) return project;

      // Filter out standalone applicants with 0 capital who are already listed as actual applicants
      const cleanedParticipants = project.participants.filter(p => {
        // If this person has capital, keep them
        if (Number(p.initialCapital || 0) > 0) return true;

        // If they have 0 capital, check if they're someone's actual applicant
        const isActualApplicant = project.participants.some(otherP => {
          // Check bracket notation
          const bracketMatch = otherP.name.match(/^(.+?)\s*\((.+?)\)$/);
          if (bracketMatch && bracketMatch[2].trim() === p.name) {
            return true;
          }
          // Check actualApplicantName field
          if (otherP.actualApplicantName === p.name) {
            return true;
          }
          return false;
        });

        // If they're listed as actual applicant elsewhere, remove this standalone entry
        return !isActualApplicant;
      });

      return {
        ...project,
        participants: cleanedParticipants
      };
    });

    setSavedProjects(cleaned);

    // Also update cloud
    cleaned.forEach(async (project) => {
      try {
        await saveProjectToCloud(project);
      } catch (error) {
        console.error('Error updating cloud:', error);
      }
    });

    alert('Cleaned up duplicate applicant entries!');
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
        actualApplicantName: "",
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

  const toggleSettlementDone = async (settlementKey) => {
    const updated = completedSettlements.includes(settlementKey)
      ? completedSettlements.filter((k) => k !== settlementKey)
      : [...completedSettlements, settlementKey];
    setCompletedSettlements(updated);

    // Auto-save to cloud
    if (currentProjectId) {
      try {
        await supabase.from(IPO_PROJECTS_TABLE).upsert({
          id: currentProjectId,
          name: ipoDetails.name,
          ipo_details: ipoDetails,
          participants,
          transfers,
          completed_settlements: updated,
        });
      } catch (error) {
        console.error("Error saving settlement status:", error);
      }
    }
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
    const grossProfit = sellingPrice > 0 ? lotsAllocated * (sellingPrice - ipoPrice) * lotSize : 0;
    const profitLoss = grossProfit - (sellingPrice > 0 ? sellingFee : 0);

    return {
      capitalUsedToApply,
      allocatedAmount,
      profitLoss,
      grossProfit,
    };
  };

  // Helper function to process participant name with bracket notation
  // E.g., "Saddiq (Sab)" means Saddiq provides capital, Sab applies
  const processParticipantName = (participant) => {
    const bracketMatch = participant.name.match(/^(.+?)\s*\((.+?)\)$/);
    if (bracketMatch) {
      return {
        ...participant,
        displayName: participant.name, // Keep original for display
        name: bracketMatch[1].trim(), // Capital provider
        willApply: false, // Capital provider doesn't apply
        actualApplicantName: bracketMatch[2].trim() // Actual applicant
      };
    }
    return {
      ...participant,
      displayName: participant.name
    };
  };

  const calculateDistribution = () => {
    // Process all participants to handle bracket notation
    const processedParticipants = participants.map(processParticipantName);

    const totalCapital = processedParticipants.reduce(
      (sum, p) => sum + Number(p.initialCapital),
      0
    );

    const totalProfit = processedParticipants.reduce((sum, p) => {
      const details = calculateParticipantDetails(p);
      return sum + details.profitLoss;
    }, 0);

    const whoGotAllocation = processedParticipants.filter((p) => p.gotAllocation);
    const whoApplied = processedParticipants.filter((p) => p.willApply);
    const onlyCapitalProviders = processedParticipants.filter((p) => !p.willApply);

    // Get unique actual applicants (those who will actually apply)
    const actualApplicants = [
      ...new Set(
        processedParticipants
          .filter((p) => p.willApply || p.actualApplicantName.trim())
          .map((p) => (p.willApply ? p.name : p.actualApplicantName.trim()))
          .filter((name) => name.trim())
      ),
    ];

    let distribution = processedParticipants.map((p) => {
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

    // New fairer formula:
    // 40% allocation luck bonus (split 70/30 if different applicant)
    // 60% distributed by capital %
    if (totalProfit !== 0) {
      // Step 1: Calculate 60% capital pool for everyone
      const capitalPool = totalProfit * 0.6;

      distribution = distribution.map((p) => {
        let share = (Number(p.initialCapital) / totalCapital) * capitalPool;
        return { ...p, profitShare: share };
      });

      // Step 2: Add 40% allocation luck bonus for those who got allocation
      processedParticipants.forEach((p) => {
        if (p.gotAllocation) {
          const details = calculateParticipantDetails(p);
          const actualProfit = details.profitLoss;
          const allocationBonus = actualProfit * 0.4;

          // Find this person in distribution
          const distPerson = distribution.find((d) => d.id === p.id);
          if (!distPerson) return;

          // Check if they applied themselves or someone else did
          if (p.willApply) {
            // Applied themselves - keep 100% of allocation bonus
            distPerson.profitShare += allocationBonus;
          } else if (p.actualApplicantName && p.actualApplicantName.trim()) {
            // Someone else applied - split 70/30
            // Capital provider (this person) gets 70%
            distPerson.profitShare += allocationBonus * 0.7;

            // Applicant gets 30% - find them in distribution by name
            const applicant = distribution.find((d) => d.name === p.actualApplicantName.trim());
            if (applicant) {
              applicant.profitShare += allocationBonus * 0.3;
            } else {
              // If applicant not in pool, create entry for them
              const applicantEntry = {
                id: `applicant-${p.actualApplicantName.trim()}`,
                name: p.actualApplicantName.trim(),
                initialCapital: 0,
                capitalPercent: 0,
                profitShare: allocationBonus * 0.3,
                actualProfitReceived: 0,
                tierMatchingTransferOut: 0,
                tierMatchingTransferIn: 0,
                settlementTransferOut: 0,
                settlementTransferIn: 0,
                netPosition: 0,
              };
              distribution.push(applicantEntry);
            }
          }
        }
      });
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

  // Calculate aggregated summary across all saved projects
  const calculateAggregatedSummary = () => {
    const summary = {};

    if (!savedProjects || savedProjects.length === 0) {
      return [];
    }

    savedProjects.forEach((project) => {
      // Calculate distribution for this project
      if (!project || !project.ipoDetails || !project.participants) {
        return; // Skip invalid projects
      }

      const tempIpoDetails = project.ipoDetails;
      const tempParticipants = project.participants;
      const tempTransfers = project.transfers || [];

      const totalCapital = tempParticipants.reduce(
        (sum, p) => sum + Number(p.initialCapital || 0),
        0
      );

      const totalProfit = tempParticipants.reduce((sum, p) => {
        const ipoPrice = Number(tempIpoDetails.ipoPrice || 0);
        const sellingPrice = Number(p.sellingPrice || 0);
        const lotSize = Number(tempIpoDetails.lotSize || 100);
        const sellingFee = Number(p.sellingFee || 0);
        const lotsAllocated = Number(p.lotsAllocated || 0);

        const grossProfit = sellingPrice > 0 ? lotsAllocated * (sellingPrice - ipoPrice) * lotSize : 0;
        const profitLoss = grossProfit - (sellingPrice > 0 ? sellingFee : 0);
        return sum + profitLoss;
      }, 0);

      const whoGotAllocation = tempParticipants.filter((p) => p.gotAllocation);
      const whoApplied = tempParticipants.filter((p) => p.willApply);
      const onlyCapitalProviders = tempParticipants.filter((p) => !p.willApply);

      // Calculate profit share for each participant
      tempParticipants.forEach((p) => {
        if (!p || !p.name) return; // Skip invalid participants

        // Process bracket notation (e.g., "Saddiq (Sab)")
        let processedP = { ...p };
        const bracketMatch = p.name.match(/^(.+?)\s*\((.+?)\)$/);
        if (bracketMatch) {
          processedP.name = bracketMatch[1].trim();
          processedP.willApply = false;
          processedP.actualApplicantName = bracketMatch[2].trim();
        }

        const ipoPrice = Number(tempIpoDetails.ipoPrice || 0);
        const sellingPrice = Number(p.sellingPrice || 0);
        const lotSize = Number(tempIpoDetails.lotSize || 100);
        const lotsApplied = Number(p.lotsApplied || 0);
        const lotsAllocated = Number(p.lotsAllocated || 0);

        // Calculate or use stored selling fee
        let sellingFee = Number(p.sellingFee || 0);
        if (sellingFee === 0 && lotsAllocated > 0 && sellingPrice > 0) {
          // Auto-calculate M+ fee if not already set
          const sellingAmount = lotsAllocated * lotSize * sellingPrice;
          const brokerageFee = Math.max(sellingAmount * 0.001, 8);
          const clearingFee = sellingAmount * 0.0003;
          const stampDuty = Math.max(Math.ceil(sellingAmount / 1000), 1);
          sellingFee = brokerageFee + clearingFee + stampDuty;
        }

        const capitalUsedToApply = lotsApplied * ipoPrice * lotSize;
        const grossProfit = sellingPrice > 0 ? lotsAllocated * (sellingPrice - ipoPrice) * lotSize : 0;
        const actualProfitReceived = grossProfit - (sellingPrice > 0 ? sellingFee : 0);

        const capitalPercent =
          totalCapital > 0 ? (Number(processedP.initialCapital) / totalCapital) * 100 : 0;

        // New fairer formula:
        // 60% distributed by capital % to everyone
        // 40% allocation luck bonus (split 70/30 if different applicant)
        let profitShare = 0;
        if (totalProfit !== 0) {
          // Step 1: Everyone gets their capital % of 60% pool
          const capitalPool = totalProfit * 0.6;
          profitShare = (Number(processedP.initialCapital) / totalCapital) * capitalPool;

          // Step 2: If this person got allocation, add 40% allocation bonus
          if (processedP.gotAllocation) {
            const allocationBonus = actualProfitReceived * 0.4;

            if (processedP.willApply) {
              // Applied themselves - keep 100% of allocation bonus
              profitShare += allocationBonus;
            } else if (processedP.actualApplicantName && processedP.actualApplicantName.trim()) {
              // Someone else applied - capital provider gets 70%
              profitShare += allocationBonus * 0.7;

              // Note: Applicant's 30% will be added when we process them
              // If applicant is also a participant, they'll get it in their own calculation
            }
          }

          // Step 3: If this person applied for someone else, add their 30% applicant bonus
          tempParticipants.forEach((otherP) => {
            const otherBracket = otherP.name.match(/^(.+?)\s*\((.+?)\)$/);
            let otherActualApplicant = '';

            if (otherBracket) {
              otherActualApplicant = otherBracket[2].trim();
            } else if (!otherP.willApply && otherP.actualApplicantName) {
              otherActualApplicant = otherP.actualApplicantName.trim();
            }

            // If this person is the applicant for someone who got allocation
            if (otherActualApplicant === processedP.name && otherP.gotAllocation) {
              const otherIpoPrice = Number(tempIpoDetails.ipoPrice || 0);
              const otherSellingPrice = Number(otherP.sellingPrice || 0);
              const otherLotSize = Number(tempIpoDetails.lotSize || 100);
              const otherLotsAllocated = Number(otherP.lotsAllocated || 0);

              // Calculate selling fee if not set
              let otherSellingFee = Number(otherP.sellingFee || 0);
              if (otherSellingFee === 0 && otherLotsAllocated > 0 && otherSellingPrice > 0) {
                const otherSellingAmount = otherLotsAllocated * otherLotSize * otherSellingPrice;
                otherSellingFee = Math.max(otherSellingAmount * 0.001, 8) +
                                  otherSellingAmount * 0.0003 +
                                  Math.max(Math.ceil(otherSellingAmount / 1000), 1);
              }

              const otherGrossProfit = otherSellingPrice > 0 ? otherLotsAllocated * (otherSellingPrice - otherIpoPrice) * otherLotSize : 0;
              const otherActualProfit = otherGrossProfit - (otherSellingPrice > 0 ? otherSellingFee : 0);
              const otherAllocationBonus = otherActualProfit * 0.4;

              // Applicant gets 30% of the allocation bonus
              profitShare += otherAllocationBonus * 0.3;
            }
          });
        }

        const tierMatchingTransferOut = tempTransfers
          .filter((t) => t.from === p.id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const tierMatchingTransferIn = tempTransfers
          .filter((t) => t.to === p.id)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const netPosition =
          profitShare + tierMatchingTransferIn - tierMatchingTransferOut;

        // Aggregate by participant name (use processed name for proper grouping)
        const aggregateName = processedP.name;
        if (!summary[aggregateName]) {
          summary[aggregateName] = {
            name: aggregateName,
            totalCapitalContributed: 0,
            totalCapitalUsed: 0,
            totalProfit: 0,
            totalProfitShare: 0,
            totalNetPosition: 0,
            ipoCount: 0,
            allocationCount: 0,
            totalLotsAllocated: 0,
            totalAllocationCapital: 0,
            ipoDetails: [],
          };
        }

        summary[aggregateName].totalCapitalContributed += Number(processedP.initialCapital || 0);
        summary[aggregateName].totalCapitalUsed += capitalUsedToApply;
        summary[aggregateName].totalProfit += actualProfitReceived;
        summary[aggregateName].totalProfitShare += profitShare;
        summary[aggregateName].totalNetPosition += netPosition;
        summary[aggregateName].ipoCount += 1;

        // Track allocations
        if (processedP.gotAllocation && lotsAllocated > 0) {
          summary[aggregateName].allocationCount += 1;
          summary[aggregateName].totalLotsAllocated += lotsAllocated;
          summary[aggregateName].totalAllocationCapital += lotsAllocated * ipoPrice * lotSize;
        }
        summary[aggregateName].ipoDetails.push({
          ipoName: tempIpoDetails.name || 'Unknown IPO',
          capital: Number(processedP.initialCapital || 0),
          profitShare: profitShare,
          netPosition: netPosition,
        });
      });

      // After processing all participants, check for non-participant applicants
      tempParticipants.forEach((otherP) => {
        const otherBracket = otherP.name.match(/^(.+?)\s*\((.+?)\)$/);
        let applicantName = '';

        if (otherBracket) {
          applicantName = otherBracket[2].trim();
        } else if (!otherP.willApply && otherP.actualApplicantName) {
          applicantName = otherP.actualApplicantName.trim();
        }

        // If there's an applicant who got allocation
        if (applicantName && otherP.gotAllocation) {
          // Check if this applicant is already a participant
          const applicantIsParticipant = tempParticipants.some(p => {
            const pBracket = p.name.match(/^(.+?)\s*\((.+?)\)$/);
            const pName = pBracket ? pBracket[1].trim() : p.name;
            return pName === applicantName;
          });

          if (!applicantIsParticipant) {
            // Calculate the applicant bonus
            const otherIpoPrice = Number(tempIpoDetails.ipoPrice || 0);
            const otherSellingPrice = Number(otherP.sellingPrice || 0);
            const otherLotSize = Number(tempIpoDetails.lotSize || 100);
            const otherLotsAllocated = Number(otherP.lotsAllocated || 0);

            // Calculate selling fee
            let otherSellingFee = Number(otherP.sellingFee || 0);
            if (otherSellingFee === 0 && otherLotsAllocated > 0 && otherSellingPrice > 0) {
              const otherSellingAmount = otherLotsAllocated * otherLotSize * otherSellingPrice;
              otherSellingFee = Math.max(otherSellingAmount * 0.001, 8) +
                                otherSellingAmount * 0.0003 +
                                Math.max(Math.ceil(otherSellingAmount / 1000), 1);
            }

            const otherGrossProfit = otherLotsAllocated * (otherSellingPrice - otherIpoPrice) * otherLotSize;
            const otherActualProfit = otherGrossProfit - otherSellingFee;
            const applicantBonus = otherActualProfit * 0.4 * 0.3;

            if (!summary[applicantName]) {
              // Create new entry for the applicant
              summary[applicantName] = {
                name: applicantName,
                totalCapitalContributed: 0,
                totalCapitalUsed: 0,
                totalProfit: 0,
                totalProfitShare: applicantBonus,
                totalNetPosition: applicantBonus,
                ipoCount: 1,
                allocationCount: 0,
                totalLotsAllocated: 0,
                totalAllocationCapital: 0,
                ipoDetails: [{
                  ipoName: tempIpoDetails.name || 'Unknown IPO',
                  capital: 0,
                  profitShare: applicantBonus,
                  netPosition: applicantBonus,
                }]
              };
            } else {
              // Add to existing applicant entry
              summary[applicantName].totalProfitShare += applicantBonus;
              summary[applicantName].totalNetPosition += applicantBonus;
              summary[applicantName].ipoCount += 1;
              summary[applicantName].ipoDetails.push({
                ipoName: tempIpoDetails.name || 'Unknown IPO',
                capital: 0,
                profitShare: applicantBonus,
                netPosition: applicantBonus,
              });
            }
          }
        }
      });
    });

    return Object.values(summary);
  };

  // Clean, money-conserving per-member totals across all IPOs.
  // Used by the Summary standings and Settlements tabs so the books always balance.
  // cash = what each member physically pocketed from selling allocated shares.
  // fair = what each member is owed under the 60% capital / 40% allocation (70/30) formula.
  const computeMemberTotals = () => {
    const mPlusFee = (amt) =>
      amt > 0
        ? Math.max(amt * 0.001, 8) + amt * 0.0003 + Math.max(Math.ceil(amt / 1000), 1)
        : 0;
    // Strip invisible/zero-width characters so e.g. "⁠Deena" and "Deena" merge.
    const clean = (s) =>
      (s || "")
        .normalize("NFKC")
        .replace(/[​-‍⁠﻿]/g, "")
        .trim();
    const totals = {};
    const touch = (name) => {
      if (!totals[name]) {
        totals[name] = {
          name,
          totalCapitalContributed: 0,
          totalCapitalUsed: 0,
          totalProfit: 0, // cash pocketed
          totalProfitShare: 0, // fair share
          ipoCount: 0,
          allocationCount: 0,
          totalLotsAllocated: 0,
        };
      }
      return totals[name];
    };

    (savedProjects || []).forEach((project) => {
      const d = project?.ipoDetails;
      if (!d || !d.name || !(Number(d.ipoPrice) > 0)) return;
      const price = Number(d.ipoPrice);
      const lot = Number(d.lotSize || 100);
      const parts = project.participants || [];
      const totalCap = parts.reduce((s, p) => s + Number(p.initialCapital || 0), 0);

      const meta = parts.map((p) => {
        const bm = clean(p.name).match(/^(.+?)\s*\((.+?)\)$/);
        const capName = bm ? clean(bm[1]) : clean(p.name);
        const applicant = bm
          ? clean(bm[2])
          : !p.willApply
          ? clean(p.actualApplicantName)
          : "";
        const sp = Number(p.sellingPrice || 0);
        const la = Number(p.lotsAllocated || 0);
        const applied = Number(p.lotsApplied || 0);
        const capUsed = applied * price * lot; // capital actually put to work applying
        let fee = Number(p.sellingFee || 0);
        if (fee === 0 && la > 0 && sp > 0) fee = mPlusFee(la * lot * sp);
        const net = (p.gotAllocation && sp > 0) ? la * (sp - price) * lot - fee : 0;
        return { capName, applicant, cap: Number(p.initialCapital || 0), capUsed, got: p.gotAllocation, la, net };
      });

      const totalProfit = meta.reduce((s, m) => s + m.net, 0);
      const totalCapUsed = meta.reduce((s, m) => s + m.capUsed, 0);

      meta.forEach((m) => {
        const rec = touch(m.capName);
        rec.totalCapitalContributed += m.cap;
        rec.totalCapitalUsed += m.capUsed;
        rec.ipoCount += 1;
        if (m.got) {
          rec.totalProfit += m.net;
          rec.allocationCount += 1;
          rec.totalLotsAllocated += m.la;
        }
        if (totalProfit !== 0) {
          // 60% capital pool is shared by how much capital each member actually
          // used to apply (lots applied x price), not just what they parked in the pool.
          const weight =
            totalCapUsed > 0
              ? m.capUsed / totalCapUsed
              : totalCap > 0
              ? m.cap / totalCap
              : 0;
          rec.totalProfitShare += weight * totalProfit * 0.6;
          // 40% luck component applies to the allocation winner — symmetric for
          // gains AND losses (a losing allocation bears 40% of its own loss), so
          // the books always balance.
          if (m.got) {
            const bonus = m.net * 0.4;
            if (m.applicant) {
              rec.totalProfitShare += bonus * 0.7;
              touch(m.applicant).totalProfitShare += bonus * 0.3;
              touch(m.applicant).ipoCount += 0; // ensure applicant exists
            } else {
              rec.totalProfitShare += bonus;
            }
          }
        }
      });
    });

    return Object.values(totals).map((t) => ({
      ...t,
      totalNetPosition: t.totalProfitShare, // final amount each member keeps
      settleBalance: t.totalProfitShare - t.totalProfit, // + = receive, - = pay
    }));
  };

  const getMemberIpoHistory = (memberName) => {
    const mPlusFee = (amt) => amt > 0 ? Math.max(amt*0.001,8)+amt*0.0003+Math.max(Math.ceil(amt/1000),1) : 0;
    const cleanN = (s) => (s||'').normalize('NFKC').replace(/[​-‍⁠﻿]/g,'').trim();
    const parseKey = (ds) => {
      if (!ds) return 0;
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) return new Date(ds).getTime();
      const mm = {'jan':'01','januari':'01','feb':'02','februari':'02','mar':'03','mac':'03','apr':'04','april':'04','may':'05','mei':'05','jun':'06','june':'06','jul':'07','july':'07','aug':'08','ogos':'08','sep':'09','sept':'09','oct':'10','okt':'10','nov':'11','dec':'12','dis':'12'};
      const m = ds.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (m) { const mo = mm[m[2].toLowerCase()]||'01'; return new Date(`${m[3]}-${mo}-${m[1].padStart(2,'0')}`).getTime(); }
      return 0;
    };
    const rows = [];
    (savedProjects||[]).forEach(project => {
      const d = project?.ipoDetails;
      if (!d?.name || !(Number(d.ipoPrice)>0)) return;
      const price = Number(d.ipoPrice);
      const lot = Number(d.lotSize||100);
      const parts = project.participants||[];
      const totalCapUsed = parts.reduce((s,p) => s+Number(p.lotsApplied||0)*price*lot, 0);
      const totalProfit = parts.reduce((s,p) => {
        const sp = Number(p.sellingPrice||0);
        const la = Number(p.lotsAllocated||0);
        if (!p.gotAllocation||sp===0) return s;
        return s + la*(sp-price)*lot - mPlusFee(la*lot*sp);
      }, 0);
      parts.forEach(p => {
        const bm = cleanN(p.name).match(/^(.+?)\s*\((.+?)\)$/);
        const capName = bm ? cleanN(bm[1]) : cleanN(p.name);
        const applicant = bm ? cleanN(bm[2]) : (!p.willApply ? cleanN(p.actualApplicantName||'') : '');
        if (capName !== memberName && applicant !== memberName) return;
        const sp = Number(p.sellingPrice||0);
        const la = Number(p.lotsAllocated||0);
        const capUsed = Number(p.lotsApplied||0)*price*lot;
        const net = (p.gotAllocation && sp>0) ? la*(sp-price)*lot - mPlusFee(la*lot*sp) : 0;
        let fairShare = 0;
        if (totalProfit !== 0) {
          if (capName === memberName) {
            const w = totalCapUsed>0 ? capUsed/totalCapUsed : 0;
            fairShare += w * totalProfit * 0.6;
            if (p.gotAllocation) {
              const bonus = net * 0.4;
              fairShare += applicant ? bonus*0.7 : bonus;
            }
          }
          if (applicant === memberName && p.gotAllocation) {
            fairShare += net * 0.4 * 0.3;
          }
        }
        rows.push({ ipoName: d.name, date: d.applicationDate, capitalIn: Number(p.initialCapital||0), lotsApplied: Number(p.lotsApplied||0), gotAllocation: !!p.gotAllocation, lotsAllocated: la, sellingPrice: sp, net, fairShare, pending: p.gotAllocation && sp===0 });
      });
    });
    return rows.sort((a,b) => parseKey(a.date)-parseKey(b.date));
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

  // Wait until we've checked for an existing session (avoids flashing login)
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  // Admin login gate — must log in before seeing the app
  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">IPO Pooling Fund</h1>
              <p className="text-gray-500 text-sm">Admin access only</p>
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => {
              setPwInput(e.target.value);
              setPwError("");
            }}
            autoFocus
            placeholder="Enter admin password"
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none ${
              pwError
                ? "border-red-400 focus:ring-red-400"
                : "border-gray-300 focus:ring-indigo-500"
            }`}
          />
          {pwError && (
            <p className="text-red-600 text-sm mt-2">{pwError}</p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full mt-5 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
          >
            {loggingIn ? "Signing in…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

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
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                <FileInput className="w-5 h-5" />
                Quick Import
              </button>
              <button
                onClick={saveCurrentProject}
                disabled={isLoading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                <Save className="w-5 h-5" />
                {isLoading ? "Saving..." : "Save to Cloud"}
              </button>
              <button
                onClick={() => setShowProjectList(!showProjectList)}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                Cloud Projects ({savedProjects.length}) {isOnline ? "🟢" : "🔴"}
              </button>
              <button
                onClick={handleLogout}
                title="Lock / log out"
                className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                🔒
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

        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Quick Import IPO Data</h2>
                    <p className="text-sm opacity-90 mt-1">
                      Paste your IPO data and we'll extract the information automatically
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      handleClearImport();
                    }}
                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Paste Your IPO Data Here
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full h-64 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none font-mono text-sm"
                    placeholder={`Paste your data in this format:

JSSOLAR | JS SOLAR HOLDING BERHAD (RM0.31 : 23 Sept 2025)
1. Zaim tier 8 - 11100 unit - RM3441 ✅ (5000 unit) sold RM0.40
2. Fairuz tier 9 - 20100 unit - RM6233 ❌

You can paste multiple IPOs at once!`}
                  />
                </div>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={handleParseText}
                    disabled={!importText.trim()}
                    className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 font-semibold"
                  >
                    <Check className="w-5 h-5" />
                    Parse & Preview
                  </button>
                  {parsedData && parsedData.length > 1 && (
                    <button
                      onClick={handleImportAllIPOs}
                      disabled={isLoading}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 font-semibold"
                    >
                      <Save className="w-5 h-5" />
                      {isLoading ? "Importing..." : `Import All ${parsedData.length} IPOs to Cloud`}
                    </button>
                  )}
                  <button
                    onClick={handleClearImport}
                    className="flex items-center gap-2 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                    Clear
                  </button>
                </div>

                {parseError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800">Parse Error</p>
                        <p className="text-sm text-red-700">{parseError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {parsedData && parsedData.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Extracted {parsedData.length} IPO{parsedData.length > 1 ? 's' : ''} - Please Confirm
                    </h3>

                    <div className="space-y-4">
                      {parsedData.map((ipoData, index) => (
                        <div
                          key={index}
                          className="border-2 border-gray-200 rounded-lg p-5 hover:border-orange-500 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h4 className="text-lg font-bold text-gray-800">
                                {ipoData.ipoDetails.name}
                              </h4>
                              <div className="text-sm text-gray-600 mt-1">
                                <p>IPO Price: RM {ipoData.ipoDetails.ipoPrice}</p>
                                <p>Application Date: {ipoData.ipoDetails.applicationDate || 'Not specified'}</p>
                                <p>Lot Size: {ipoData.ipoDetails.lotSize} units</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleImportIPO(ipoData)}
                              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                            >
                              Import This IPO
                            </button>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="font-semibold text-gray-700 mb-3">
                              {ipoData.participants.length} Participants Found:
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-2">Name</th>
                                    <th className="text-right py-2 px-2">Capital (RM)</th>
                                    <th className="text-right py-2 px-2">Lots Applied</th>
                                    <th className="text-center py-2 px-2">Got Allocation?</th>
                                    <th className="text-right py-2 px-2">Lots Allocated</th>
                                    <th className="text-right py-2 px-2">Selling Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ipoData.participants.map((p, pIndex) => (
                                    <tr key={pIndex} className="border-b hover:bg-white">
                                      <td className="py-2 px-2 font-medium">{p.name}</td>
                                      <td className="py-2 px-2 text-right">{p.initialCapital.toLocaleString()}</td>
                                      <td className="py-2 px-2 text-right">{p.lotsApplied}</td>
                                      <td className="py-2 px-2 text-center">
                                        {p.gotAllocation ? (
                                          <span className="bg-green-200 px-2 py-1 rounded text-xs">✓ Yes</span>
                                        ) : (
                                          <span className="bg-gray-200 px-2 py-1 rounded text-xs">No</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-right">{p.lotsAllocated || '-'}</td>
                                      <td className="py-2 px-2 text-right">
                                        {p.sellingPrice > 0 ? `RM ${p.sellingPrice.toFixed(2)}` : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-3 rounded">
                              <p className="font-semibold text-blue-800 mb-1">Note:</p>
                              <p>• You can edit all details in the Participants tab after importing</p>
                              <p>• <strong className="text-green-700">Selling fees auto-calculate</strong> using M+ rates when you enter selling price</p>
                              <p>• Transfer information (tier matching) can be added in the Transfers tab</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showProjectList && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Cloud Storage {isOnline ? "🟢 Online" : "🔴 Offline"}
                </h2>
                <p className="text-sm text-gray-600">
                  Projects are saved to Supabase cloud database
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cleanupDuplicateApplicants}
                  disabled={savedProjects.length === 0}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                  title="Remove duplicate Sab entries with 0 capital"
                >
                  <MinusCircle className="w-5 h-5" />
                  Cleanup Duplicates
                </button>
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
              onClick={() => setActiveTab("summary")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "summary"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <TrendingUp className="w-5 h-5 inline mr-2" />
              All IPOs Summary
            </button>
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
            <button
              onClick={() => setActiveTab("settlements")}
              className={`flex-shrink-0 px-6 py-4 font-semibold transition-colors ${
                activeTab === "settlements"
                  ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                  : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              💸 Settlements
            </button>
          </div>

          <div className="p-6">
            {activeTab === "summary" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Aggregated Summary - All IPO Projects
                </h2>

                {!savedProjects || savedProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      No Saved Projects Yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Import or create IPO projects to see aggregated summary here.
                    </p>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold"
                    >
                      Quick Import IPOs
                    </button>
                  </div>
                ) : (() => {
                  try {
                    const summaryData = computeMemberTotals();
                    return (
                  <>
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-6 mb-6">
                      <h3 className="text-xl font-bold mb-3">
                        Portfolio Overview
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm opacity-90">Total IPO Projects</p>
                          <p className="text-3xl font-bold">{savedProjects.length}</p>
                        </div>
                        <div>
                          <p className="text-sm opacity-90">Total Capital Deployed</p>
                          <p className="text-3xl font-bold">
                            RM{" "}
                            {savedProjects
                              .reduce((sum, project) => {
                                if (!project.participants) return sum;
                                return (
                                  sum +
                                  project.participants.reduce(
                                    (s, p) => s + Number(p.initialCapital || 0),
                                    0
                                  )
                                );
                              }, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm opacity-90">Net Profit/Loss</p>
                          <p className="text-3xl font-bold">
                            RM{" "}
                            {summaryData
                              .reduce((sum, p) => sum + (p.totalNetPosition || 0), 0)
                              .toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Member standings */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-bold text-gray-800">Member Standings — All {savedProjects.length} IPOs</h3>
                        <button
                          onClick={() => setActiveTab("settlements")}
                          className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg hover:bg-yellow-200 transition-colors font-medium"
                        >
                          💸 See who pays who →
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                              <th className="text-left px-5 py-3 font-medium">Member</th>
                              <th className="text-right px-4 py-3 font-medium">Total Capital</th>
                              <th className="text-right px-4 py-3 font-medium">Cap %</th>
                              <th className="text-center px-4 py-3 font-medium">IPOs / Won</th>
                              <th className="text-right px-4 py-3 font-medium">Cash Pocketed</th>
                              <th className="text-right px-5 py-3 font-medium">Fair Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const totalCapAll = summaryData.reduce((s, p) => s + (p.totalCapitalContributed || 0), 0);
                              return summaryData
                                .slice()
                                .sort((a, b) => b.totalNetPosition - a.totalNetPosition)
                                .flatMap((p, idx) => {
                                  const capPct = totalCapAll > 0 ? (p.totalCapitalContributed / totalCapAll) * 100 : 0;
                                  const isOpen = expandedMember === p.name;
                                  const result = [
                                    <tr key={idx} className={`border-b cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50' : 'hover:bg-gray-50'}`} onClick={() => setExpandedMember(isOpen ? null : p.name)}>
                                      <td className="px-5 py-3 font-semibold text-gray-800">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-400 text-xs w-3 flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                                          {p.name}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right text-gray-600">RM {p.totalCapitalContributed.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right text-gray-500">{capPct.toFixed(1)}%</td>
                                      <td className="px-4 py-3 text-center text-gray-500">
                                        {p.ipoCount} / <span className="text-green-600 font-medium">{p.allocationCount}</span>
                                      </td>
                                      <td className="px-4 py-3 text-right text-gray-500">
                                        {p.totalProfit > 0 ? `RM ${p.totalProfit.toFixed(2)}` : "—"}
                                      </td>
                                      <td className={`px-5 py-3 text-right font-bold text-base ${p.totalProfitShare >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {p.totalProfitShare >= 0 ? "+" : ""}RM {p.totalProfitShare.toFixed(2)}
                                      </td>
                                    </tr>
                                  ];
                                  if (isOpen) {
                                    const history = getMemberIpoHistory(p.name);
                                    const totalNet = history.reduce((s,r)=>s+r.net,0);
                                    const totalFs = history.reduce((s,r)=>s+r.fairShare,0);
                                    result.push(
                                      <tr key={`detail-${idx}`}>
                                        <td colSpan={6} className="bg-indigo-50 border-b px-6 pb-4 pt-1">
                                          <table className="w-full text-xs mt-1">
                                            <thead>
                                              <tr className="text-gray-500 border-b border-indigo-200">
                                                <th className="text-left py-2 pr-4 font-medium">IPO</th>
                                                <th className="text-left py-2 pr-4 font-medium">Date</th>
                                                <th className="text-right py-2 pr-4 font-medium">Capital</th>
                                                <th className="text-right py-2 pr-4 font-medium">Lots</th>
                                                <th className="text-center py-2 pr-4 font-medium">Result</th>
                                                <th className="text-right py-2 pr-4 font-medium">Net Profit</th>
                                                <th className="text-right py-2 font-medium">Fair Share</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {history.map((row, ri) => (
                                                <tr key={ri} className={`border-b border-indigo-100 last:border-0 ${row.gotAllocation && !row.pending ? 'bg-green-50/60' : ''}`}>
                                                  <td className="py-2 pr-4 font-medium text-gray-700 max-w-[180px] truncate">{row.ipoName}</td>
                                                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{row.date || '—'}</td>
                                                  <td className="py-2 pr-4 text-right text-gray-600">RM {row.capitalIn.toLocaleString()}</td>
                                                  <td className="py-2 pr-4 text-right text-gray-500">{row.lotsApplied}</td>
                                                  <td className="py-2 pr-4 text-center whitespace-nowrap">
                                                    {row.pending
                                                      ? <span className="text-amber-600 font-medium">⏳ {row.lotsAllocated} lots</span>
                                                      : row.gotAllocation
                                                      ? <span className="text-green-600 font-medium">✅ {row.lotsAllocated} @ RM{row.sellingPrice}</span>
                                                      : <span className="text-gray-400">❌</span>}
                                                  </td>
                                                  <td className={`py-2 pr-4 text-right font-semibold ${row.net > 0 ? 'text-green-600' : row.net < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                                    {row.gotAllocation && !row.pending ? `RM ${row.net.toFixed(2)}` : '—'}
                                                  </td>
                                                  <td className={`py-2 text-right font-bold ${row.fairShare > 0 ? 'text-indigo-600' : row.fairShare < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                                                    {row.fairShare !== 0 ? `RM ${row.fairShare.toFixed(2)}` : '—'}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot>
                                              <tr className="border-t-2 border-indigo-300 font-semibold text-xs">
                                                <td colSpan={2} className="py-2 text-gray-700">{history.length} IPOs · {history.filter(r=>r.gotAllocation).length} wins</td>
                                                <td className="py-2 pr-4 text-right text-gray-700">RM {history.reduce((s,r)=>s+r.capitalIn,0).toLocaleString()}</td>
                                                <td className="py-2 pr-4 text-right text-gray-500">{history.reduce((s,r)=>s+r.lotsApplied,0)}</td>
                                                <td className="py-2 pr-4 text-center text-gray-500">{history.filter(r=>r.gotAllocation&&!r.pending).length} allocated</td>
                                                <td className={`py-2 pr-4 text-right ${totalNet>=0?'text-green-600':'text-red-600'}`}>RM {totalNet.toFixed(2)}</td>
                                                <td className={`py-2 text-right ${totalFs>=0?'text-indigo-600':'text-red-600'}`}>RM {totalFs.toFixed(2)}</td>
                                              </tr>
                                              <tr className="text-xs">
                                                <td colSpan={5} className="py-1.5 text-gray-500 italic">Balance (Fair Share − Cash Pocketed)</td>
                                                <td colSpan={2} className={`py-1.5 text-right font-bold ${(totalFs-totalNet)>=0?'text-green-600':'text-red-600'}`}>
                                                  {(totalFs-totalNet)>=0?'Receive':'Pay'} RM {Math.abs(totalFs-totalNet).toFixed(2)}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return result;
                                });
                            })()}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
                              <td className="px-5 py-3 text-gray-700">Total</td>
                              <td className="px-4 py-3 text-right text-gray-700">
                                RM {summaryData.reduce((s, p) => s + (p.totalCapitalContributed || 0), 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500">100%</td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right text-gray-500">
                                RM {summaryData.reduce((s, p) => s + (p.totalProfit || 0), 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-3 text-right text-green-600 font-bold text-base">
                                RM {summaryData.reduce((s, p) => s + (p.totalProfitShare || 0), 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 className="font-bold text-gray-800 text-xl">📋 Per-IPO Breakdown</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={ipoSearch}
                            onChange={(e) => setIpoSearch(e.target.value)}
                            placeholder="Search IPO…"
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none w-40"
                          />
                          <button
                            onClick={() => {
                              const all = {};
                              savedProjects.forEach((p, i) => { all[p.id || i] = true; });
                              setExpandedIpos(all);
                            }}
                            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Expand all
                          </button>
                          <button
                            onClick={() => setExpandedIpos({})}
                            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Collapse all
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const _monthMap = {'jan':'01','januari':'01','january':'01','feb':'02','februari':'02','february':'02','mar':'03','mac':'03','march':'03','apr':'04','april':'04','may':'05','mei':'05','jun':'06','june':'06','jul':'07','july':'07','aug':'08','ogos':'08','august':'08','sep':'09','sept':'09','september':'09','oct':'10','okt':'10','oktober':'10','october':'10','nov':'11','november':'11','dec':'12','dis':'12','disember':'12','december':'12'};
                          const _parseDK = (ds) => {
                            if (!ds) return 0;
                            if (/^\d{4}-\d{2}-\d{2}/.test(ds)) return new Date(ds).getTime();
                            const m = ds.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
                            if (m) { const mo = _monthMap[m[2].toLowerCase()] || '01'; return new Date(`${m[3]}-${mo}-${m[1].padStart(2,'0')}`).getTime(); }
                            return 0;
                          };
                          const _MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                          const _fmtMonth = (ds) => { const ts = _parseDK(ds); if (!ts) return 'Unknown'; const d = new Date(ts); return `${_MN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
                          const sorted = savedProjects
                            .filter(p => p && p.ipoDetails && p.ipoDetails.name && p.ipoDetails.ipoPrice)
                            .filter(p => !ipoSearch.trim() || p.ipoDetails.name.toLowerCase().includes(ipoSearch.trim().toLowerCase()))
                            .slice()
                            .sort((a, b) => _parseDK(a.ipoDetails.applicationDate) - _parseDK(b.ipoDetails.applicationDate));
                          let _lastMonth = null;
                          const _items = [];
                          sorted.forEach((project, projectIdx) => {
                            const _ml = _fmtMonth(project.ipoDetails.applicationDate);
                            if (_ml !== _lastMonth) {
                              _lastMonth = _ml;
                              _items.push(<div key={`month-${_ml}`} className="flex items-center gap-3 pt-3 pb-1"><span className="text-xs font-semibold text-indigo-500 uppercase tracking-widest whitespace-nowrap">{_ml}</span><div className="flex-1 h-px bg-indigo-100" /></div>);
                            }
                          const tempIpoDetails = project.ipoDetails;
                          const tempParticipants = project.participants || [];
                          const tempTransfers = project.transfers || [];
                          const ipoPrice = Number(tempIpoDetails.ipoPrice || 0);
                          const lotSize = Number(tempIpoDetails.lotSize || 100);

                          const totalCapital = tempParticipants.reduce((s, p) => s + Number(p.initialCapital || 0), 0);
                          const totalCapUsed = tempParticipants.reduce((s, p) => s + Number(p.lotsApplied || 0) * ipoPrice * lotSize, 0);
                          const totalProfit = tempParticipants.reduce((s, p) => {
                            const sp = Number(p.sellingPrice || 0);
                            const la = Number(p.lotsAllocated || 0);
                            let fee = Number(p.sellingFee || 0);
                            if (fee === 0 && la > 0 && sp > 0) {
                              const amt = la * lotSize * sp;
                              fee = Math.max(amt * 0.001, 8) + amt * 0.0003 + Math.max(Math.ceil(amt / 1000), 1);
                            }
                            return s + (sp > 0 ? la * (sp - ipoPrice) * lotSize - fee : 0);
                          }, 0);

                          const allocated = tempParticipants.filter(p => p.gotAllocation);
                          const pending = totalProfit === 0 && allocated.length > 0;
                          const winners = [...new Set(allocated.map(p => p.name.replace(/\s*\(.+?\)$/, '').trim()))];
                          const ipoKey = project.id || projectIdx;
                          const isOpen = !!expandedIpos[ipoKey];
                          const toggleIpo = () => setExpandedIpos(prev => ({ ...prev, [ipoKey]: !prev[ipoKey] }));

                            _items.push(
                            <div key={project.id || projectIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                              {/* IPO Header (click to expand) */}
                              <button
                                onClick={toggleIpo}
                                className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-gray-400 text-sm flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900 text-sm truncate">{tempIpoDetails.name}</h4>
                                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                      <span>{tempIpoDetails.applicationDate || '—'}</span>
                                      <span>RM{ipoPrice}/share</span>
                                      <span className="text-green-600">{winners.length ? `🏆 ${winners.join(', ')}` : 'no allocation'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  <div className={`font-bold text-base ${totalProfit > 0 ? 'text-green-600' : totalProfit < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {totalProfit !== 0 ? `RM ${totalProfit.toFixed(2)}` : pending ? 'Pending' : '—'}
                                  </div>
                                  <div className="text-xs text-gray-400">{totalProfit !== 0 ? 'profit' : ''}</div>
                                </div>
                              </button>

                              {/* Participants table */}
                              {isOpen && (
                              <table className="w-full text-sm border-t border-gray-200">
                                <thead>
                                  <tr className="text-xs text-gray-500 border-b bg-gray-50">
                                    <th className="text-left px-5 py-2 font-medium">Name</th>
                                    <th className="text-right px-4 py-2 font-medium">Capital</th>
                                    <th className="text-right px-4 py-2 font-medium">Applied %</th>
                                    <th className="text-center px-4 py-2 font-medium">Allocation</th>
                                    <th className="text-right px-4 py-2 font-medium">Net Profit</th>
                                    <th className="text-right px-4 py-2 font-medium">Fair Share</th>
                                    <th className="text-right px-5 py-2 font-medium">ROI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tempParticipants.map((p, pIdx) => {
                                    const sp = Number(p.sellingPrice || 0);
                                    const la = Number(p.lotsAllocated || 0);
                                    let fee = Number(p.sellingFee || 0);
                                    if (fee === 0 && la > 0 && sp > 0) {
                                      const amt = la * lotSize * sp;
                                      fee = Math.max(amt * 0.001, 8) + amt * 0.0003 + Math.max(Math.ceil(amt / 1000), 1);
                                    }
                                    const netProfit = sp > 0 ? la * (sp - ipoPrice) * lotSize - fee : 0;
                                    const capUsed = Number(p.lotsApplied || 0) * ipoPrice * lotSize;
                                    const capPct = totalCapUsed > 0 ? (capUsed / totalCapUsed) * 100 : 0;

                                    let processedP = { ...p };
                                    const bm = p.name.match(/^(.+?)\s*\((.+?)\)$/);
                                    if (bm) { processedP.willApply = false; processedP.actualApplicantName = bm[2].trim(); }

                                    let fairShare = 0;
                                    if (totalProfit !== 0) {
                                      const weight = totalCapUsed > 0 ? capUsed / totalCapUsed : 0;
                                      fairShare = weight * totalProfit * 0.6;
                                      if (p.gotAllocation) {
                                        const bonus = netProfit * 0.4;
                                        fairShare += processedP.willApply !== false ? bonus : bonus * 0.7;
                                      }
                                      tempParticipants.forEach(op => {
                                        const obm = op.name.match(/^(.+?)\s*\((.+?)\)$/);
                                        const oapplicant = obm ? obm[2].trim() : (!op.willApply ? op.actualApplicantName : '');
                                        const pName = bm ? bm[1].trim() : p.name;
                                        if (oapplicant === pName && op.gotAllocation) {
                                          const osp = Number(op.sellingPrice || 0);
                                          const ola = Number(op.lotsAllocated || 0);
                                          let ofee = Number(op.sellingFee || 0);
                                          if (ofee === 0 && ola > 0 && osp > 0) {
                                            const oamt = ola * lotSize * osp;
                                            ofee = Math.max(oamt * 0.001, 8) + oamt * 0.0003 + Math.max(Math.ceil(oamt / 1000), 1);
                                          }
                                          const onet = osp > 0 ? ola * (osp - ipoPrice) * lotSize - ofee : 0;
                                          fairShare += onet * 0.4 * 0.3;
                                        }
                                      });
                                    }

                                    const tierIn = tempTransfers.filter(t => t.to === p.id).reduce((s, t) => s + Number(t.amount || 0), 0);
                                    const tierOut = tempTransfers.filter(t => t.from === p.id).reduce((s, t) => s + Number(t.amount || 0), 0);
                                    const finalAmt = fairShare + tierIn - tierOut;
                                    const roi = Number(p.initialCapital || 0) > 0 ? (finalAmt / Number(p.initialCapital)) * 100 : 0;

                                    return (
                                      <tr key={pIdx} className={`border-b last:border-0 hover:bg-gray-50 ${p.gotAllocation ? 'bg-green-50/30' : ''}`}>
                                        <td className="px-5 py-3">
                                          <div className="font-semibold text-gray-800">{p.name}</div>
                                          {processedP.actualApplicantName && (
                                            <div className="text-xs text-gray-400">applied by {processedP.actualApplicantName}</div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">RM {Number(p.initialCapital || 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{capPct.toFixed(1)}%</td>
                                        <td className="px-4 py-3 text-center">
                                          {p.gotAllocation
                                            ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">✓ {la} lots @ RM{sp}</span>
                                            : <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-400 text-xs px-2.5 py-1 rounded-full">No luck</span>
                                          }
                                        </td>
                                        <td className={`px-4 py-3 text-right font-semibold ${p.gotAllocation && netProfit > 0 ? 'text-green-600' : p.gotAllocation && netProfit < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                          {p.gotAllocation ? `RM ${netProfit.toFixed(2)}` : '—'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${fairShare > 0 ? 'text-indigo-600' : fairShare < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                          {totalProfit !== 0 ? `RM ${fairShare.toFixed(2)}` : '—'}
                                        </td>
                                        <td className={`px-5 py-3 text-right font-semibold text-sm ${roi > 0 ? 'text-green-600' : roi < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                          {totalProfit !== 0 && Number(p.initialCapital) > 0 ? `${roi.toFixed(1)}%` : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                {totalProfit !== 0 && (
                                  <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold">
                                      <td className="px-5 py-3 text-gray-700">Total</td>
                                      <td className="px-4 py-3 text-right text-gray-700">RM {totalCapital.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right text-gray-500">100%</td>
                                      <td className="px-4 py-3 text-center text-gray-500">{allocated.length} got allocation</td>
                                      <td className="px-4 py-3 text-right text-green-600">RM {totalProfit.toFixed(2)}</td>
                                      <td className="px-4 py-3 text-right text-indigo-600">RM {totalProfit.toFixed(2)}</td>
                                      <td className="px-5 py-3 text-right text-green-600">
                                        {totalCapital > 0 ? `${((totalProfit / totalCapital) * 100).toFixed(1)}%` : '—'}
                                      </td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                              )}
                            </div>
                            );
                          });
                          return _items;
                        })()}
                      </div>
                    </div>
                  </>
                    );
                  } catch (error) {
                    console.error('Error rendering summary tab:', error);
                    return (
                      <div className="text-center py-12">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                          Error Loading Summary
                        </h3>
                        <p className="text-gray-500 mb-4">
                          {error.message || 'An error occurred while calculating the summary. Please try refreshing the page.'}
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                        >
                          Refresh Page
                        </button>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

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
                        2. By default, all participants "Will Apply" - check
                        this box
                      </p>
                      <p>
                        3. If participant won't apply, uncheck "Will Apply" and
                        enter who will apply for them in "Actual Applicant"
                        field
                      </p>
                      <p>
                        4. Enter lots applied manually OR click "Max" button to
                        use all available capital
                      </p>
                      <p>
                        5. After allocation results: Check "Got Allocation" and
                        enter lots allocated
                      </p>
                      <p>
                        6. After selling: Enter selling price - <strong className="text-green-700">Selling fee auto-calculates using M+ rates!</strong>
                      </p>
                      <p>
                        7. Net Profit auto-calculates: Gross Profit - Selling
                        Fee
                      </p>
                      <p className="mt-2 text-xs bg-blue-100 p-2 rounded">
                        💡 <strong>Max Button:</strong> Calculates maximum lots
                        based on: Initial Capital ÷ (IPO Price × Lot Size)
                      </p>
                      <p className="mt-2 text-xs bg-green-100 p-2 rounded">
                        💰 <strong>M+ Selling Fee (Auto):</strong> Brokerage 0.1% (min RM8) + Clearing 0.03% + Stamp Duty RM1/RM1000 (min RM1)
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
                        <th className="border px-3 py-2 text-left font-semibold">
                          Actual Applicant
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
                          <div className="flex flex-col">
                            <span>Selling Fee (RM)</span>
                            <span className="text-xs font-normal text-green-600">Auto M+</span>
                          </div>
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
                                type="text"
                                value={p.actualApplicantName || ""}
                                onChange={(e) =>
                                  updateParticipant(
                                    p.id,
                                    "actualApplicantName",
                                    e.target.value
                                  )
                                }
                                disabled={p.willApply}
                                placeholder={
                                  p.willApply
                                    ? "This person applies"
                                    : "Enter who will apply"
                                }
                                className="w-32 px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
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
                                  updateParticipantWithAutoFee(
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
                                  updateParticipantWithAutoFee(
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
                              <div className="flex flex-col gap-1">
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
                                {p.gotAllocation && Number(p.lotsAllocated) > 0 && Number(p.sellingPrice) > 0 && (
                                  <span className="text-xs text-green-600 text-center">
                                    Auto M+
                                  </span>
                                )}
                              </div>
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
                  <div className="text-center py-16">
                    <AlertCircle className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      {!ipoDetails.name ? "No project loaded" : "Distribution not ready yet"}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                      {!ipoDetails.name
                        ? "This tab shows distribution for a single loaded project. To see all IPOs together, use the Summary or Settlements tabs."
                        : !hasAllocationData
                        ? "Mark who got allocation in the Participants tab first."
                        : "Enter selling prices for participants who got allocation."}
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      {!ipoDetails.name && (
                        <>
                          <button
                            onClick={() => setActiveTab("summary")}
                            className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                          >
                            All IPOs Summary
                          </button>
                          <button
                            onClick={() => setActiveTab("settlements")}
                            className="bg-yellow-500 text-white px-5 py-2.5 rounded-lg hover:bg-yellow-600 transition-colors font-medium text-sm"
                          >
                            💸 Settlements
                          </button>
                          <button
                            onClick={() => setShowProjectList(true)}
                            className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                          >
                            Load Single Project
                          </button>
                        </>
                      )}
                    </div>
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
                              Lots Allocated
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Capital Used
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Selling Price
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Sold Amount
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Gross Profit
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Selling Fee
                            </th>
                            <th className="border px-3 py-2 text-right font-semibold">
                              Net Profit
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

                            // Calculate detailed breakdown
                            const lotsAllocated = Number(p.lotsAllocated || 0);
                            const ipoPrice = Number(ipoDetails.ipoPrice || 0);
                            const lotSize = Number(ipoDetails.lotSize || 100);
                            const sellingPrice = Number(p.sellingPrice || 0);

                            const capitalUsed = lotsAllocated * ipoPrice * lotSize;
                            const soldAmount = lotsAllocated * sellingPrice * lotSize;
                            const grossProfit = soldAmount - capitalUsed;

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
                                <td className="border px-3 py-2 text-right font-medium text-purple-600">
                                  {p.gotAllocation && lotsAllocated > 0
                                    ? `${lotsAllocated} lots`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-orange-600 font-semibold">
                                  {p.gotAllocation && capitalUsed > 0
                                    ? `RM ${capitalUsed.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-blue-600 font-medium">
                                  {p.gotAllocation && Number(p.sellingPrice) > 0
                                    ? `RM ${Number(p.sellingPrice).toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-blue-600 font-semibold">
                                  {p.gotAllocation && soldAmount > 0
                                    ? `RM ${soldAmount.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}`
                                    : "-"}
                                </td>
                                <td className={`border px-3 py-2 text-right font-semibold ${
                                  grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {p.gotAllocation
                                    ? `RM ${grossProfit.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}`
                                    : "-"}
                                </td>
                                <td className="border px-3 py-2 text-right text-red-600 text-xs">
                                  {p.gotAllocation && Number(p.sellingFee) > 0
                                    ? `-RM ${Number(p.sellingFee).toFixed(2)}`
                                    : "-"}
                                </td>
                                <td className={`border px-3 py-2 text-right font-bold ${
                                  p.actualProfitReceived >= 0 ? 'text-green-700' : 'text-red-700'
                                }`}>
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
                            <td className="border px-3 py-2 text-right text-purple-600">
                              {distribution
                                .filter(p => p.gotAllocation)
                                .reduce((sum, p) => sum + Number(p.lotsAllocated || 0), 0)} lots
                            </td>
                            <td className="border px-3 py-2 text-right text-orange-600">
                              RM{" "}
                              {distribution
                                .filter(p => p.gotAllocation)
                                .reduce((sum, p) => {
                                  const lots = Number(p.lotsAllocated || 0);
                                  const price = Number(ipoDetails.ipoPrice || 0);
                                  const lotSize = Number(ipoDetails.lotSize || 100);
                                  return sum + (lots * price * lotSize);
                                }, 0)
                                .toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                            </td>
                            <td className="border px-3 py-2"></td>
                            <td className="border px-3 py-2 text-right text-blue-600">
                              RM{" "}
                              {distribution
                                .filter(p => p.gotAllocation)
                                .reduce((sum, p) => {
                                  const lots = Number(p.lotsAllocated || 0);
                                  const sellingPrice = Number(p.sellingPrice || 0);
                                  const lotSize = Number(ipoDetails.lotSize || 100);
                                  return sum + (lots * sellingPrice * lotSize);
                                }, 0)
                                .toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                            </td>
                            <td className="border px-3 py-2 text-right text-green-600">
                              RM{" "}
                              {distribution
                                .filter(p => p.gotAllocation)
                                .reduce((sum, p) => {
                                  const lots = Number(p.lotsAllocated || 0);
                                  const ipoPrice = Number(ipoDetails.ipoPrice || 0);
                                  const sellingPrice = Number(p.sellingPrice || 0);
                                  const lotSize = Number(ipoDetails.lotSize || 100);
                                  const capitalUsed = lots * ipoPrice * lotSize;
                                  const soldAmount = lots * sellingPrice * lotSize;
                                  return sum + (soldAmount - capitalUsed);
                                }, 0)
                                .toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                            </td>
                            <td className="border px-3 py-2 text-right text-red-600 text-xs">
                              -RM{" "}
                              {distribution
                                .reduce(
                                  (sum, p) => sum + Number(p.sellingFee || 0),
                                  0
                                )
                                .toFixed(2)}
                            </td>
                            <td className="border px-3 py-2 text-right text-green-700 font-bold">
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

            {activeTab === "settlements" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">💸 Final Settlements</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Across all {savedProjects.length} IPOs. Members who sold allocated shares hold the cash and pay out to the rest, so everyone ends with their fair share.
                </p>

                {!savedProjects || savedProjects.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No projects yet.</div>
                ) : (() => {
                  const people = computeMemberTotals();

                  const creditors = people
                    .filter(p => p.settleBalance > 0.01)
                    .sort((a, b) => b.settleBalance - a.settleBalance);
                  const debtors = people
                    .filter(p => p.settleBalance < -0.01)
                    .sort((a, b) => a.settleBalance - b.settleBalance);

                  const creditorsCopy = creditors.map(c => ({ ...c, remaining: c.settleBalance }));
                  const debtorsCopy = debtors.map(d => ({ ...d, remaining: Math.abs(d.settleBalance) }));

                  // Relationship priority — keep money within close circles first.
                  const RELATIONSHIPS = [
                    { pair: ["Zaim", "Deena"], score: 3, label: "💑 spouses" },
                    { pair: ["Amer", "Sab"], score: 3, label: "💑 spouses" },
                    { pair: ["Amer", "Fairuz"], score: 2, label: "🤝 close" },
                    { pair: ["Amer", "Saddiq"], score: 2, label: "🤝 close" },
                  ];
                  const relOf = (a, b) =>
                    RELATIONSHIPS.find(
                      r => (r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a)
                    ) || null;

                  // Greedily settle the most closely-related payer/receiver pair first,
                  // tie-broken by the largest amount (fewer transfers). Falls back to
                  // unrelated pairs only once no related balances remain.
                  const settlements = [];
                  while (true) {
                    const cs = creditorsCopy.filter(c => c.remaining > 0.01);
                    const ds = debtorsCopy.filter(d => d.remaining > 0.01);
                    if (!cs.length || !ds.length) break;
                    let best = null;
                    for (const c of cs) for (const d of ds) {
                      const amt = Math.min(c.remaining, d.remaining);
                      const rel = relOf(c.name, d.name);
                      const score = rel ? rel.score : 0;
                      if (!best || score > best.score || (score === best.score && amt > best.amt)) {
                        best = { c, d, amt, score, label: rel ? rel.label : null };
                      }
                    }
                    settlements.push({ from: best.d.name, to: best.c.name, amount: best.amt, relation: best.label });
                    best.c.remaining -= best.amt;
                    best.d.remaining -= best.amt;
                  }

                  return (
                    <>
                      {/* Net position cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                        {people
                          .slice()
                          .sort((a, b) => b.settleBalance - a.settleBalance)
                          .map(p => (
                            <div
                              key={p.name}
                              className={`rounded-xl p-4 text-center border-2 ${
                                p.settleBalance > 0.01
                                  ? "bg-green-50 border-green-400"
                                  : p.settleBalance < -0.01
                                  ? "bg-red-50 border-red-400"
                                  : "bg-gray-50 border-gray-300"
                              }`}
                            >
                              <div className="font-bold text-gray-800 text-lg mb-1">{p.name}</div>
                              <div className={`text-2xl font-extrabold ${
                                p.settleBalance > 0.01 ? "text-green-600"
                                  : p.settleBalance < -0.01 ? "text-red-600"
                                  : "text-gray-500"
                              }`}>
                                {p.settleBalance > 0.01 ? "+" : ""}RM {p.settleBalance.toFixed(2)}
                              </div>
                              <div className={`text-xs mt-1 font-medium ${
                                p.settleBalance > 0.01 ? "text-green-500"
                                  : p.settleBalance < -0.01 ? "text-red-500"
                                  : "text-gray-400"
                              }`}>
                                {p.settleBalance > 0.01 ? "will receive"
                                  : p.settleBalance < -0.01 ? "needs to pay"
                                  : "settled"}
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Transfer instructions */}
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
                        <h3 className="text-xl font-bold text-yellow-900 mb-1">
                          Transfer Instructions
                        </h3>
                        <p className="text-sm text-yellow-700 mb-5">
                          {settlements.length === 0
                            ? "All accounts are already settled — no transfers needed."
                            : `${settlements.length} transfer${settlements.length > 1 ? "s" : ""} needed to close all ${savedProjects.length} IPOs ${
                                completedSettlements.length > 0
                                  ? `• ${completedSettlements.length} completed ✓`
                                  : ""
                              }`}
                        </p>

                        <div className="space-y-3">
                          {settlements.length === 0 ? (
                            <div className="text-center py-6 text-green-600 font-semibold text-lg">
                              ✅ Nothing to settle!
                            </div>
                          ) : settlements.map((s, idx) => {
                            const settlementKey = `${s.from}-${s.to}-${s.amount}`;
                            const isDone = completedSettlements.includes(settlementKey);
                            return (
                            <div
                              key={idx}
                              className={`flex items-center gap-4 rounded-xl px-5 py-4 shadow-sm border transition-all ${
                                isDone
                                  ? "bg-green-50 border-green-300 opacity-70"
                                  : "bg-white border-yellow-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => toggleSettlementDone(settlementKey)}
                                className="w-5 h-5 cursor-pointer flex-shrink-0"
                              />
                              <div className="w-7 h-7 rounded-full bg-yellow-400 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 flex items-center gap-2 flex-wrap">
                                <span className={`font-bold text-lg ${isDone ? "line-through text-gray-500" : "text-red-700"}`}>{s.from}</span>
                                <span className="text-gray-400 text-sm">pays</span>
                                <span className={`font-bold text-lg ${isDone ? "line-through text-gray-500" : "text-green-700"}`}>{s.to}</span>
                                {s.relation && (
                                  <span className="text-xs font-medium bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                                    {s.relation}
                                  </span>
                                )}
                              </div>
                              <div className={`text-2xl font-extrabold px-5 py-2 rounded-lg border ${
                                isDone
                                  ? "text-green-700 bg-green-50 border-green-200"
                                  : "text-indigo-700 bg-indigo-50 border-indigo-200"
                              }`}>
                                RM {s.amount.toFixed(2)}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Per-person breakdown */}
                      <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="bg-gray-100 px-5 py-3 border-b">
                          <h3 className="font-bold text-gray-800">Per-Person Breakdown (All {savedProjects.length} IPOs)</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Total Capital</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Cash Pocketed</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Fair Share</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Balance</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {people
                                .slice()
                                .sort((a, b) => b.settleBalance - a.settleBalance)
                                .map((p, idx) => {
                                  const action = p.settleBalance > 0.01
                                    ? { label: `Receive RM ${p.settleBalance.toFixed(2)}`, color: "text-green-600 bg-green-50" }
                                    : p.settleBalance < -0.01
                                    ? { label: `Pay RM ${Math.abs(p.settleBalance).toFixed(2)}`, color: "text-red-600 bg-red-50" }
                                    : { label: "Settled ✓", color: "text-gray-500 bg-gray-50" };
                                  return (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                      <td className="px-4 py-3 font-semibold text-gray-800">{p.name}</td>
                                      <td className="px-4 py-3 text-right text-gray-600">RM {p.totalCapitalContributed.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right text-blue-600 font-medium">
                                        {p.totalProfit > 0 ? `RM ${p.totalProfit.toFixed(2)}` : "—"}
                                      </td>
                                      <td className="px-4 py-3 text-right text-indigo-600 font-medium">
                                        RM {p.totalProfitShare.toFixed(2)}
                                      </td>
                                      <td className={`px-4 py-3 text-right font-bold text-base ${
                                        p.settleBalance > 0.01 ? "text-green-600"
                                          : p.settleBalance < -0.01 ? "text-red-600"
                                          : "text-gray-400"
                                      }`}>
                                        {p.settleBalance > 0 ? "+" : ""}RM {p.settleBalance.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${action.color}`}>
                                          {action.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

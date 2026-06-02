/**
 * IPO Text Parser - Extracts IPO information from formatted text
 *
 * Expected format:
 * IPO_NAME | Full Company Name (RM0.31 : 23 Sept 2025)
 * 1. Name tier X - XXXXX unit - RMXXXX ✅ (XXXX unit) sold RM0.XX
 * 2. Name tier X - XXXXX unit - RMXXXX ❌
 */

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr) {
  const months = {
    'jan': '01', 'januari': '01', 'january': '01',
    'feb': '02', 'februari': '02', 'february': '02',
    'mar': '03', 'mac': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05', 'mei': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'ogos': '08', 'august': '08',
    'sep': '09', 'sept': '09', 'september': '09',
    'oct': '10', 'okt': '10', 'oktober': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'dis': '12', 'disember': '12', 'december': '12'
  };

  // Match patterns like "23 Sept 2025", "7 Okt 2025", etc.
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthStr = match[2].toLowerCase();
    const year = match[3];
    const month = months[monthStr] || '01';
    return `${year}-${month}-${day}`;
  }
  return '';
}

/**
 * Parse a participant line
 * Examples:
 * "1. Zaim tier 8 - 11100 unit - RM3441 ✅ (5000 unit) sold RM0.40"
 * "2. Fairuz tier 9 - 20100 unit - RM6233 ❌"
 */
function parseParticipantLine(line, lotSize = 100) {
  // Remove leading number and dot
  const cleanLine = line.replace(/^\d+\.\s*/, '').trim();

  // Extract name (everything before "tier")
  const nameMatch = cleanLine.match(/^(.+?)\s+tier/i);
  let name = nameMatch ? nameMatch[1].trim() : '';

  // Check if name contains brackets like "Saddiq (Sab)"
  // This means capital provider (actual applicant)
  let actualApplicantName = '';
  let willApply = true;

  const bracketMatch = name.match(/^(.+?)\s*\((.+?)\)$/);
  if (bracketMatch) {
    // Capital provider is before bracket, applicant is in bracket
    name = bracketMatch[1].trim();
    actualApplicantName = bracketMatch[2].trim();
    willApply = false; // Capital provider doesn't apply, someone else does
  }

  // Extract tier number
  const tierMatch = cleanLine.match(/tier\s+(\d+)/i);
  const tier = tierMatch ? parseInt(tierMatch[1]) : 0;

  // Extract total units
  const unitsMatch = cleanLine.match(/(\d+)\s*unit/i);
  const totalUnits = unitsMatch ? parseInt(unitsMatch[1]) : 0;

  // Extract initial capital (RM amount before status symbol)
  const capitalMatch = cleanLine.match(/RM\s*(\d+(?:\.\d+)?)/i);
  const initialCapital = capitalMatch ? parseFloat(capitalMatch[1]) : 0;

  // Check if got allocation (✅)
  const gotAllocation = cleanLine.includes('✅');

  // Extract sold units and selling price if available
  let unitsSold = 0;
  let sellingPrice = 0;

  if (gotAllocation) {
    const soldMatch = cleanLine.match(/\((\d+)\s*unit\)\s*sold\s*(?:RM)?\s*(\d+\.?\d*)/i);
    if (soldMatch) {
      unitsSold = parseInt(soldMatch[1]);
      sellingPrice = parseFloat(soldMatch[2]);
    }
  }

  // Convert units to lots
  const lotsApplied = Math.floor(totalUnits / lotSize);
  const lotsAllocated = gotAllocation ? (unitsSold > 0 ? Math.floor(unitsSold / lotSize) : lotsApplied) : 0;

  return {
    name,
    tier,
    totalUnits,
    initialCapital,
    lotsApplied,
    gotAllocation,
    lotsAllocated,
    sellingPrice,
    willApply,
    actualApplicantName,
    sellingFee: 0 // Will need to be entered manually
  };
}

/**
 * Parse IPO header line
 * Example: "JSSOLAR | JS SOLAR HOLDING BERHAD (RM0.31 : 23 Sept 2025)"
 */
function parseHeaderLine(line) {
  // Extract short name (before |)
  const shortNameMatch = line.match(/^([^|]+)/);
  const shortName = shortNameMatch ? shortNameMatch[1].trim() : '';

  // Extract full name (between | and ()
  const fullNameMatch = line.match(/\|\s*(.+?)\s*\(/);
  const fullName = fullNameMatch ? fullNameMatch[1].trim() : '';

  // Extract price
  const priceMatch = line.match(/RM\s*(\d+\.?\d*)/);
  const ipoPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Extract date
  const dateMatch = line.match(/:\s*(.+?)\)/);
  const dateStr = dateMatch ? dateMatch[1].trim() : '';
  const applicationDate = parseDate(dateStr);

  return {
    shortName,
    fullName,
    ipoPrice,
    applicationDate
  };
}

/**
 * Parse complete IPO text block
 */
export function parseIPOText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length === 0) {
    throw new Error('No text provided');
  }

  const result = {
    ipos: []
  };

  let currentIPO = null;

  for (const line of lines) {
    // Check if this is a header line (contains | and RM)
    if (line.includes('|') && line.includes('(RM')) {
      // Save previous IPO if exists
      if (currentIPO && currentIPO.participants.length > 0) {
        result.ipos.push(currentIPO);
      }

      // Start new IPO
      const headerInfo = parseHeaderLine(line);
      currentIPO = {
        name: headerInfo.fullName || headerInfo.shortName,
        shortName: headerInfo.shortName,
        ipoPrice: headerInfo.ipoPrice,
        applicationDate: headerInfo.applicationDate,
        lotSize: 100, // Default
        participants: []
      };
    }
    // Check if this is a participant line (starts with number followed by dot)
    else if (line.match(/^\d+\.\s+/)) {
      if (currentIPO) {
        const participant = parseParticipantLine(line, currentIPO.lotSize);
        if (participant.name) {
          currentIPO.participants.push(participant);
        }
      }
    }
  }

  // Add last IPO
  if (currentIPO && currentIPO.participants.length > 0) {
    result.ipos.push(currentIPO);
  }

  if (result.ipos.length === 0) {
    throw new Error('No valid IPO data found in text');
  }

  return result;
}

/**
 * Convert parsed data to application format
 */
export function convertToAppFormat(parsedData) {
  return parsedData.ipos.map((ipo, index) => {
    const participants = ipo.participants.map((p, pIndex) => ({
      id: pIndex + 1,
      name: p.name,
      initialCapital: p.initialCapital,
      willApply: p.willApply,
      actualApplicantName: p.actualApplicantName,
      lotsApplied: p.lotsApplied,
      gotAllocation: p.gotAllocation,
      lotsAllocated: p.lotsAllocated,
      sellingPrice: p.sellingPrice,
      sellingFee: p.sellingFee
    }));

    return {
      ipoDetails: {
        name: ipo.name,
        applicationDate: ipo.applicationDate,
        ipoPrice: ipo.ipoPrice,
        lotSize: ipo.lotSize
      },
      participants,
      transfers: [],
      metadata: {
        tier: ipo.participants[0]?.tier || 0,
        shortName: ipo.shortName
      }
    };
  });
}

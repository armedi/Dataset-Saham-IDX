/**
 * Script to fetch list of all emiten (stock issuers) from IDX API
 * and save them to CSV files
 */

interface EmitenData {
  Code: string;
  Name: string;
  ListingDate: string;
  Shares: number;
  ListingBoard: string;
}

interface ApiResponse {
  data: EmitenData[];
}

const LQ45_CODES_URL = 'List Emiten/LQ45.csv';

/**
 * Fetch list of emiten from IDX API
 */
async function fetchEmitenList(): Promise<EmitenData[]> {
  const allEmiten: EmitenData[] = [];
  let start = 0;
  const length = 150; // Maximum supported length

  console.log('Fetching list of all emiten from IDX API...');

  while (true) {
    const url = `https://idx.co.id/umbraco/Surface/StockData/GetSecuritiesStock?code=&sector=&board=&start=${start}&length=${length}`;
    
    try {
      console.log(`Fetching batch starting at ${start}...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse = await response.json();
      
      // If no data, we've reached the end
      if (!result.data || result.data.length === 0) {
        break;
      }
      
      allEmiten.push(...result.data);
      console.log(`Fetched ${result.data.length} emiten (total: ${allEmiten.length})`);
      
      // Move to next batch
      start += length;
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching data at start=${start}:`, error);
      throw error;
    }
  }

  console.log(`Total emiten fetched: ${allEmiten.length}`);
  return allEmiten;
}

/**
 * Escape CSV field if it contains special characters
 */
function escapeCsvField(field: string | number): string {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse a CSV line properly handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Read existing LQ45 codes from CSV (if exists)
 */
async function getExistingLQ45Codes(): Promise<Set<string>> {
  try {
    const file = Bun.file(LQ45_CODES_URL);
    const content = await file.text();
    const lines = content.split('\n').slice(1); // Skip header
    const codes = new Set<string>();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = parseCsvLine(line);
      const code = parts[0].trim();
      if (code) {
        codes.add(code);
      }
    }
    
    console.log(`Found ${codes.size} LQ45 codes in existing file`);
    return codes;
  } catch (error) {
    console.log('No existing LQ45 file found, will use empty set');
    return new Set<string>();
  }
}

/**
 * Convert emiten data to CSV format
 */
function toCsv(emiten: EmitenData[]): string {
  const header = 'code,name,listingDate,shares,listingBoard\n';
  const rows = emiten.map(e => 
    `${escapeCsvField(e.Code)},${escapeCsvField(e.Name)},${escapeCsvField(e.ListingDate)},${escapeCsvField(e.Shares)},${escapeCsvField(e.ListingBoard)}`
  ).join('\n');
  
  return header + rows;
}

/**
 * Main function
 */
async function main() {
  try {
    // Ensure directory exists
    console.log('Ensuring List Emiten directory exists...');
    await Bun.write('List Emiten/.gitkeep', '');
    console.log('✓ Directory ready\n');
    
    // Fetch all emiten
    const allEmiten = await fetchEmitenList();
    
    // Get existing LQ45 codes
    const lq45Codes = await getExistingLQ45Codes();
    
    // Filter LQ45 emiten
    const lq45Emiten = allEmiten.filter(e => lq45Codes.has(e.Code));
    
    console.log(`Found ${lq45Emiten.length} LQ45 emiten out of ${allEmiten.length} total`);
    
    // Save all emiten to CSV
    const allCsv = toCsv(allEmiten);
    await Bun.write('List Emiten/all.csv', allCsv);
    console.log('✓ Saved all emiten to List Emiten/all.csv');
    
    // Save LQ45 emiten to CSV (only if we have LQ45 codes)
    if (lq45Emiten.length > 0) {
      const lq45Csv = toCsv(lq45Emiten);
      await Bun.write('List Emiten/LQ45.csv', lq45Csv);
      console.log('✓ Saved LQ45 emiten to List Emiten/LQ45.csv');
    } else {
      console.log('⚠ No LQ45 codes found, skipping LQ45.csv update');
    }
    
    console.log('\n✅ Successfully fetched and saved emiten list');
  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

main();

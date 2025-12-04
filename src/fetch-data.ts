/**
 * Script to fetch stock trading data for all emiten from IDX API
 * Continues from the last available data instead of redownloading from beginning
 */

interface StockData {
  Date: string;
  Previous: number;
  OpenPrice: number;
  FirstTrade: number;
  High: number;
  Low: number;
  Close: number;
  Change: number;
  Volume: number;
  Value: number;
  Frequency: number;
  IndexIndividual: number;
  Offer: number;
  OfferVolume: number;
  Bid: number;
  BidVolume: number;
  ListedShares: number;
  TradebleShares: number;
  WeightForIndex: number;
  ForeignSell: number;
  ForeignBuy: number;
  DelistingDate: string;
  NonRegularVolume: number;
  NonRegularValue: number;
  NonRegularFrequency: number;
}

interface ApiResponse {
  replies: StockData[];
}

interface EmitenInfo {
  code: string;
  name: string;
  listingDate: string;
  shares: number;
  listingBoard: string;
}

interface InfoJson {
  last_update: string;
}

const CSV_COLUMNS = [
  'date',
  'previous',
  'open_price',
  'first_trade',
  'high',
  'low',
  'close',
  'change',
  'volume',
  'value',
  'frequency',
  'index_individual',
  'offer',
  'offer_volume',
  'bid',
  'bid_volume',
  'listed_shares',
  'tradeble_shares',
  'weight_for_index',
  'foreign_sell',
  'foreign_buy',
  'delisting_date',
  'non_regular_volume',
  'non_regular_value',
  'non_regular_frequency'
];

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
 * Read emiten list from CSV
 */
async function readEmitenList(): Promise<EmitenInfo[]> {
  const file = Bun.file('List Emiten/all.csv');
  const content = await file.text();
  const lines = content.split('\n').slice(1); // Skip header
  
  const emiten: EmitenInfo[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = parseCsvLine(line);
    if (parts.length >= 5) {
      emiten.push({
        code: parts[0].trim(),
        name: parts[1].trim(),
        listingDate: parts[2].trim(),
        shares: parseFloat(parts[3]) || 0,
        listingBoard: parts[4].trim()
      });
    }
  }
  
  return emiten;
}

/**
 * Get the last date from an existing CSV file
 */
async function getLastDate(code: string): Promise<string | null> {
  try {
    const file = Bun.file(`Saham/Semua/${code}.csv`);
    const content = await file.text();
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) return null; // Only header or empty
    
    const lastLine = lines[lines.length - 1];
    const parts = parseCsvLine(lastLine);
    const date = parts[0];
    return date;
  } catch {
    return null;
  }
}

/**
 * Calculate days difference between two dates
 */
function getDaysDifference(dateStr: string): number {
  const lastDate = new Date(dateStr);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get existing data from CSV
 */
async function getExistingData(code: string): Promise<Set<string>> {
  const existingDates = new Set<string>();
  
  try {
    const file = Bun.file(`Saham/Semua/${code}.csv`);
    const content = await file.text();
    const lines = content.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = parseCsvLine(line);
      const date = parts[0];
      existingDates.add(date);
    }
  } catch {
    // File doesn't exist, return empty set
  }
  
  return existingDates;
}

/**
 * Fetch stock data for a single emiten
 */
async function fetchStockData(code: string, length: number): Promise<StockData[]> {
  const url = `https://idx.co.id/umbraco/Surface/ListedCompany/GetTradingInfoSS?code=${code}&length=${length}`;
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse = await response.json();
      return result.replies || [];
    } catch (error) {
      lastError = error as Error;
      console.error(`  Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch data');
}

/**
 * Convert stock data to CSV row
 */
function stockDataToCsvRow(data: StockData): string {
  return [
    escapeCsvField(data.Date),
    escapeCsvField(data.Previous),
    escapeCsvField(data.OpenPrice),
    escapeCsvField(data.FirstTrade),
    escapeCsvField(data.High),
    escapeCsvField(data.Low),
    escapeCsvField(data.Close),
    escapeCsvField(data.Change),
    escapeCsvField(data.Volume),
    escapeCsvField(data.Value),
    escapeCsvField(data.Frequency),
    escapeCsvField(data.IndexIndividual),
    escapeCsvField(data.Offer),
    escapeCsvField(data.OfferVolume),
    escapeCsvField(data.Bid),
    escapeCsvField(data.BidVolume),
    escapeCsvField(data.ListedShares),
    escapeCsvField(data.TradebleShares),
    escapeCsvField(data.WeightForIndex),
    escapeCsvField(data.ForeignSell),
    escapeCsvField(data.ForeignBuy),
    escapeCsvField(data.DelistingDate),
    escapeCsvField(data.NonRegularVolume),
    escapeCsvField(data.NonRegularValue),
    escapeCsvField(data.NonRegularFrequency)
  ].join(',');
}

/**
 * Read LQ45 codes
 */
async function getLQ45Codes(): Promise<Set<string>> {
  try {
    const file = Bun.file('List Emiten/LQ45.csv');
    const content = await file.text();
    const lines = content.split('\n').slice(1); // Skip header
    const codes = new Set<string>();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = parseCsvLine(line);
      const code = parts[0].trim();
      if (code) codes.add(code);
    }
    
    return codes;
  } catch {
    return new Set<string>();
  }
}

/**
 * Process a single emiten
 */
async function processEmiten(
  emiten: EmitenInfo,
  lq45Codes: Set<string>
): Promise<{ success: boolean; newRecords: number }> {
  const { code } = emiten;
  
  try {
    console.log(`\nProcessing ${code}...`);
    
    // Get last date from existing file
    const lastDate = await getLastDate(code);
    
    let length: number;
    if (lastDate) {
      const daysSinceLastUpdate = getDaysDifference(lastDate);
      length = daysSinceLastUpdate + 5; // Add buffer
      console.log(`  Last data: ${lastDate} (${daysSinceLastUpdate} days ago)`);
      console.log(`  Fetching last ${length} days...`);
    } else {
      length = 365; // Get full year for new stocks
      console.log(`  No existing data, fetching full year (${length} days)...`);
    }
    
    // Fetch data
    const stockData = await fetchStockData(code, length);
    
    if (stockData.length === 0) {
      console.log(`  No data available for ${code}`);
      return { success: true, newRecords: 0 };
    }
    
    // Get existing dates
    const existingDates = await getExistingData(code);
    
    // Filter out existing dates and reverse (oldest first)
    const newData = stockData
      .filter(data => !existingDates.has(data.Date))
      .reverse();
    
    if (newData.length === 0) {
      console.log(`  No new data for ${code}`);
      return { success: true, newRecords: 0 };
    }
    
    console.log(`  Found ${newData.length} new records`);
    
    // Read existing file or create header
    let existingContent = '';
    try {
      const file = Bun.file(`Saham/Semua/${code}.csv`);
      existingContent = await file.text();
    } catch {
      // Create header
      existingContent = CSV_COLUMNS.join(',') + '\n';
    }
    
    // Append new data
    const newRows = newData.map(stockDataToCsvRow).join('\n');
    const updatedContent = existingContent.trimEnd() + '\n' + newRows;
    
    // Save to Saham/Semua
    await Bun.write(`Saham/Semua/${code}.csv`, updatedContent);
    console.log(`  ✓ Saved to Saham/Semua/${code}.csv`);
    
    // If LQ45, also save there
    if (lq45Codes.has(code)) {
      await Bun.write(`Saham/LQ45/${code}.csv`, updatedContent);
      console.log(`  ✓ Saved to Saham/LQ45/${code}.csv (LQ45)`);
    }
    
    return { success: true, newRecords: newData.length };
  } catch (error) {
    console.error(`  ❌ Error processing ${code}:`, error);
    return { success: false, newRecords: 0 };
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('IDX Stock Data Updater');
    console.log('='.repeat(60));
    
    // Ensure directories exist
    console.log('\nEnsuring directories exist...');
    await Bun.write('Saham/Semua/.gitkeep', '');
    await Bun.write('Saham/LQ45/.gitkeep', '');
    console.log('✓ Directories ready');
    
    // Read emiten list
    console.log('\nReading emiten list...');
    const emitenList = await readEmitenList();
    console.log(`Found ${emitenList.length} emiten to process`);
    
    // Get LQ45 codes
    const lq45Codes = await getLQ45Codes();
    console.log(`Found ${lq45Codes.size} LQ45 stocks`);
    
    // Process each emiten
    let processed = 0;
    let failed = 0;
    let totalNewRecords = 0;
    
    for (const emiten of emitenList) {
      const result = await processEmiten(emiten, lq45Codes);
      
      if (result.success) {
        processed++;
        totalNewRecords += result.newRecords;
      } else {
        failed++;
      }
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
      
      // Progress update every 10 stocks
      if ((processed + failed) % 10 === 0) {
        console.log(`\n--- Progress: ${processed + failed}/${emitenList.length} ---`);
      }
    }
    
    // Update info.json
    const today = new Date().toISOString().split('T')[0];
    const info: InfoJson = { last_update: today };
    await Bun.write('info.json', JSON.stringify(info, null, 2) + '\n');
    
    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total processed: ${processed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  New records added: ${totalNewRecords}`);
    console.log(`  Updated info.json with date: ${today}`);
    console.log('='.repeat(60));
    console.log('\n✅ Successfully updated stock data');
  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

main();

# IDX Stock Data Scraper

TypeScript scripts to fetch and update stock data from the Indonesia Stock Exchange (IDX) using Bun runtime.

## Features

- Fetches list of all emiten (stock issuers) from IDX API
- Fetches historical trading data for each stock
- **Continues from last available data** instead of redownloading from beginning
- Automatic retry with exponential backoff on failures
- Rate limiting to avoid getting banned
- Updates both "Semua" (All) and "LQ45" collections

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- Internet connection to access IDX API

## Installation

1. Install Bun (if not already installed):
```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install dependencies:
```bash
bun install
```

## Usage

### Update Everything (Recommended)

To fetch the latest emiten list and update all stock data:

```bash
bun run update-all
```

This will:
1. Fetch the latest list of emiten from IDX
2. Update stock data for all emiten, continuing from the last available date

### Fetch Emiten List Only

To only update the list of emiten:

```bash
bun run fetch-emiten
```

This updates:
- `List Emiten/all.csv` - All listed stocks
- `List Emiten/LQ45.csv` - LQ45 stocks only

### Fetch Stock Data Only

To only update stock data for existing emiten:

```bash
bun run fetch-data
```

This will:
- Read each stock's CSV file in `Saham/Semua/`
- Determine the last available date
- Fetch only new data since that date
- Append new records to existing files
- Update `info.json` with the last update date

## How It Works

### Incremental Updates

The script is smart about updates:

1. **For existing stocks**: Reads the last date in the CSV file and only fetches data from that point forward
2. **For new stocks**: Fetches the full year of data
3. **Duplicate prevention**: Checks dates before appending to avoid duplicates

### Rate Limiting

- 15 second delay between each stock request
- 1 second delay between emiten list API calls
- Automatic retry with exponential backoff on failures

### File Structure

```
.
├── List Emiten/
│   ├── all.csv          # All listed stocks
│   └── LQ45.csv         # LQ45 stocks
├── Saham/
│   ├── Semua/           # All stock data
│   │   ├── AALI.csv
│   │   ├── BBCA.csv
│   │   └── ...
│   └── LQ45/            # LQ45 stock data
│       ├── BBCA.csv
│       └── ...
├── info.json            # Last update date
└── src/                 # TypeScript source files
    ├── fetch-emiten.ts
    └── fetch-data.ts
```

## Data Source

Data is fetched from official IDX API endpoints:
- Emiten list: `https://idx.co.id/umbraco/Surface/StockData/GetSecuritiesStock`
- Trading data: `https://idx.co.id/umbraco/Surface/ListedCompany/GetTradingInfoSS`

## CSV Format

Stock data CSV files contain the following columns:
- date, previous, open_price, first_trade, high, low, close, change
- volume, value, frequency, index_individual
- offer, offer_volume, bid, bid_volume
- listed_shares, tradeble_shares, weight_for_index
- foreign_sell, foreign_buy, delisting_date
- non_regular_volume, non_regular_value, non_regular_frequency

See [Keterangan Nama Kolom.md](../Keterangan%20Nama%20Kolom.md) for detailed column descriptions.

## Notes

- The complete update can take several hours due to rate limiting (15 seconds per stock)
- Failed requests are automatically retried up to 3 times
- The script respects IDX's terms of service by including delays between requests

## Legal Notice

Data is sourced from PT Bursa Efek Indonesia (IDX). Please refer to [IDX Terms of Use](https://idx.co.id/id/syarat-penggunaan/) for usage rights and restrictions.

**This tool is for non-commercial use only.** Do not use for commercial purposes without written permission from IDX.

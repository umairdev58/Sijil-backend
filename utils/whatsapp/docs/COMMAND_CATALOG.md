# WhatsApp command catalog

Commands are natural-language examples, not rigid syntax. Dates accept `today`,
`yesterday`, `last 7 days`, `last 30 days`, `this month`, `last month`,
`this year`, month names, `DD/MM/YYYY`, and `YYYY-MM-DD`.

## Help and dashboards

- `help`
- `help sales`
- `business overview`
- `dashboard summary`
- `monthly summary`
- `top 5 outstanding`
- `pending invoices`

## Sales, payments, and receivables

- `sales today`
- `recent sales`
- `sales last 7 days`
- `sales invoice INV-100`
- `sales for customer Ahmed`
- `sales container ABC123`
- `unpaid sales`
- `overdue sales`
- `sales statistics`
- `monthly sales July 2026`
- `sales report this month`
- `recent payments`
- `sales payments invoice INV-100`
- `outstanding for customer Ahmed`
- `all outstanding`
- `overdue receivables`

## Customers and suppliers

- `customer Ahmed`
- `find customer Ahmed`
- `customer statistics`
- `supplier Ali Trading`
- `find supplier Ali`
- `supplier statistics`

If a name matches several records, the assistant lists the matches and asks for
the full name.

## Products and categories

- `list products`
- `find product apple`
- `products category Fruits`
- `product statistics`
- `list categories`
- `find category Fruit`
- `category statistics`

The system has a product catalog but no stock-quantity or warehouse module, so
the assistant does not offer stock-level commands.

## Purchases

- `recent purchases`
- `purchase container ABC123`
- `purchases this month`
- `purchase report this month`

## Daily ledger

- `ledger today`
- `ledger 21/07/2026`
- `ledger summary this month`
- `cash position today`
- `bank position yesterday`

## Freight

- `freight invoices`
- `freight invoice FR-100`
- `freight payments invoice FR-100`
- `freight container ABC123`
- `unpaid freight`
- `overdue freight`
- `freight stats`

## Transport

- `transport invoices`
- `transport invoice TR-100`
- `transport payments invoice TR-100`
- `transport agent Ahmed`
- `pending transport`
- `transport stats`

## Dubai transport

- `dubai transport invoices`
- `dubai transport invoice DT-100`
- `dubai transport payments invoice DT-100`
- `dubai transport container ABC123`
- `overdue dubai transport`
- `dubai transport stats`

## Dubai clearance

- `dubai clearance invoices`
- `dubai clearance invoice DC-100`
- `clearance payments invoice DC-100`
- `clearance agent Ahmed`
- `pending clearance`
- `clearance stats`

## Container statements

- `recent container statements`
- `container statement ABC123`
- `container summary ABC123`
- `container profit ABC123`

Container queries are read-only. They calculate the current sales-derived
summary in memory and never create or update a statement.

## Explicitly unsupported

The assistant will not create, update, delete, approve, close, pay, or record
anything. Sijil Record currently has no inventory/stock-level, bank-account
master, payroll, or standalone expense/income modules, so commands for those
domains are not offered.

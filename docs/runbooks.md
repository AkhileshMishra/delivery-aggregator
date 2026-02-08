# Operational Runbooks

## Re-authenticating a Partner

When the health endpoint reports `sessionValid: false` for a partner:

1. Check the error message in `GET /v1/health`
2. Trigger re-auth: `POST /v1/reauth/<partnerId>`
3. If the partner requires 2FA/CAPTCHA, RDP into the VM — a visible browser window will open
4. Complete the login manually in the browser
5. The system captures cookies automatically after successful login
6. Verify: `GET /v1/health` should show `sessionValid: true`

## Restarting the Service

```powershell
nssm restart DeliveryAggregator
```

## Viewing Logs

```powershell
Get-Content C:\delivery-aggregator\logs\stdout.log -Tail 100 -Wait
```

## Investigating a Failed Quote

1. Find the `debug_packet_id` from the API response's `errors` array
2. Navigate to `storage/artifacts/<debug_packet_id>/`
3. Review `meta.json` for error details, stack trace, and URL
4. Check `dom.html` for the DOM snapshot at time of failure
5. Screenshots are saved alongside if capture succeeded

## Updating Partner Selectors

When a partner changes their UI:
1. The system will start returning `SchemaMismatch` or `SelectorNotFound` errors
2. RDP into the VM, inspect the partner's website
3. Update the selectors in `src/core/partners/<partner>/selectors.ts`
4. Rebuild: `npm run build`
5. Restart: `nssm restart DeliveryAggregator`

import { Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import RiskLevelChip from '../../components/RiskLevelChip';
import { riskScore, type RiskRow } from '../../lib/risks';

export default function RiskOverview({ rows }: { rows: RiskRow[] }) {
  const high = rows.filter((r) => riskScore(r.residual) >= 4).length;
  const elevated = rows.filter((r) => r.residual === 'elevated').length;
  const reduced = rows.filter((r) => riskScore(r.residual) < riskScore(r.inherent)).length;

  return (
    <Card>
      <CardContent>
        <Stack sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Risk overview</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Built from the financials, reconciliation, securities, findings and diligence status. Updates when an adjustment is accepted.
            </Typography>
          </Box>
          <Stack sx={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" color={high ? 'error' : 'default'} variant={high ? 'filled' : 'outlined'} label={`${high} high residual`} />
            <Chip size="small" color={elevated ? 'warning' : 'default'} variant={elevated ? 'filled' : 'outlined'} label={`${elevated} elevated`} />
            <Chip size="small" variant="outlined" label={`${reduced} mitigated`} />
          </Stack>
        </Stack>

        {rows.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', mt: 2 }}>Not enough data yet. Upload the financing report to start the risk assessment.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto', mt: 2 }}>
            <Table size="small" sx={{ minWidth: 720, '& td, & th': { verticalAlign: 'top', py: 1.25 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '34%', fontWeight: 700 }}>Risk</TableCell>
                  <TableCell sx={{ width: '42%', fontWeight: 700 }}>Mitigant</TableCell>
                  <TableCell sx={{ width: '24%', fontWeight: 700 }}>Residual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>{r.category}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.risk}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{r.detail}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Based on: {r.basedOn.join(', ')}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{r.mitigant}</Typography></TableCell>
                    <TableCell>
                      <RiskLevelChip level={r.residual} />
                      {r.inherent !== r.residual && (
                        <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'text.secondary' }}>
                          <Typography variant="caption">from {r.inherent}</Typography>
                          <ArrowForward sx={{ fontSize: 12 }} />
                          <Typography variant="caption">{r.residual}</Typography>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

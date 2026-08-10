import { formatDateTime } from '../lib/format';

/**
 * Status detail rows for a single Cityworks service request.
 * Field names are as returned by ServiceRequest/ById — note IsClosed and
 * DateCancelled, which do not follow the DateTime* naming of their neighbours.
 */
export default function RequestDetails({ request }) {
    const rows = [
        ['Status', request.Status],
        ['Problem', request.Description],
        ['Submitted', formatDateTime(request.DateTimeInit)],
        ['Details', request.Details],
    ];

    if (request.IsClosed) {
        rows.push(['Closed On', formatDateTime(request.DateTimeClosed)]);
        rows.push(['Closed By', request.ClosedBy]);
    }
    if (request.Cancel) {
        rows.push(['Cancelled', formatDateTime(request.DateCancelled)]);
        rows.push(['Cancelled By', request.CancelledBy]);
        rows.push(['Reason', request.CancelReason]);
    }

    return (
        <dl className="row mb-0">
            {rows.filter(([, value]) => value).map(([label, value]) => (
                <Row key={label} label={label} value={value} />
            ))}
        </dl>
    );
}

function Row({ label, value }) {
    return (
        <>
            <dt className="col-sm-4">{label}</dt>
            <dd className="col-sm-8">{value}</dd>
        </>
    );
}

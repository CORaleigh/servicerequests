export default function RecentRequests({ requests, onRowClick }) {
    return (
        <div className="card shadow">
            <div className="card-body">
                <h4 className="card-title">Last Five Open Service Requests</h4>
                <p className="text-muted small">Click a row to view problem details</p>
                <table className="table table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Problem</th>
                            <th>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="text-muted">No open requests found.</td>
                            </tr>
                        ) : requests.map(req => (
                            <tr
                                key={req.RequestId}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onRowClick(req.RequestId)}
                            >
                                <td>{req.RequestId}</td>
                                <td>{req.Description}</td>
                                <td>{req.DateTimeInit?.replace('T', ' at ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

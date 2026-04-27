export default function ProblemSelect({ problems, selected, onChange }) {
    return (
        <div className="card shadow mb-4">
            <div className="card-body">
                <h4 className="card-title">Select Problem</h4>
                <select
                    id="problemSelect"
                    className="form-select"
                    value={selected}
                    onChange={e => onChange(e.target.value)}
                >
                    <option value="">Select a problem…</option>
                    {problems.map(p => (
                        <option key={p.ProblemSid} value={p.ProblemSid}>{p.Description}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

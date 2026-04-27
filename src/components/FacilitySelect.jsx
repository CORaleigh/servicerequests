export default function FacilitySelect({ facilities, selected, loading, onChange }) {
    return (
        <div className="card shadow mb-4">
            <div className="card-body">
                <h4 className="card-title">Select Facility</h4>
                <select
                    id="facilitySelect"
                    className="form-select"
                    value={selected}
                    disabled={loading}
                    onChange={e => onChange(e.target.value)}
                >
                    <option value="">{loading ? 'Loading facilities…' : 'Select a facility…'}</option>
                    {facilities.map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

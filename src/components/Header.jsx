import { useState } from 'react';

export default function Header({ onLookup, ready }) {
    const [statusId, setStatusId] = useState('');

    function handleLookup() {
        if (statusId.trim()) onLookup(statusId.trim());
    }

    return (
        <div id="header" className="py-3">
            <div className="container">
                <div className="row align-items-center">
                    <div className="col-sm-9">
                        <h2><strong>Facilities &amp; Operations</strong></h2>
                        <p className="lead mb-0">Online Service Request Form</p>
                    </div>
                    <div className="col-sm-3">
                        <label htmlFor="statusId" className="form-label text-white">
                            Enter ID to check status
                        </label>
                        <div className="input-group" style={{ maxWidth: 200 }}>
                            <input
                                id="statusId"
                                type="text"
                                inputMode="numeric"
                                className="form-control"
                                aria-label="Service request ID"
                                placeholder="270874"
                                value={statusId}
                                onChange={e => setStatusId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                            />
                            <button
                                className="btn btn-outline-light"
                                type="button"
                                disabled={!ready || !statusId.trim()}
                                onClick={handleLookup}
                            >
                                <i className="bi bi-search" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

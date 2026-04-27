export default function EmergencyAlert({ onClose }) {
    return (
        <div className="alert alert-warning alert-dismissible fade show shadow" role="alert">
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            This form is intended for reporting non-emergency maintenance. Please call{' '}
            <strong>919-996-3420</strong> if the problem is:
            <ul className="mb-0 mt-1">
                <li>an <strong>EMERGENCY</strong></li>
                <li>for elevator problems</li>
                <li>for janitorial service</li>
                <li>for door entrances such as keys, locks, and fobs</li>
                <li>not listed in this form</li>
                <li>for a facility not listed</li>
            </ul>
            <p className="mt-2 mb-0">
                An <strong>EMERGENCY</strong> is: a broken waterline with great amounts of water being
                lost; no electricity that compromises safety or programming; no heating or cooling that
                compromises programming; or any situation that may result in an unsafe or hazardous
                environment for patrons or staff.
            </p>
        </div>
    );
}

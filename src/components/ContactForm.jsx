function Field({ id, label, type = 'text', value, error, placeholder, onChange, children }) {
    return (
        <div className={`row mb-3 ${error ? 'has-error' : ''}`}>
            <label htmlFor={id} className="col-lg-3 col-form-label">{label}</label>
            <div className="col-lg-9">
                {children ?? (
                    <input
                        type={type}
                        id={id}
                        className="form-control"
                        placeholder={placeholder}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                    />
                )}
                {error && <span className="form-text text-danger">{error}</span>}
            </div>
        </div>
    );
}

export default function ContactForm({ values, errors, onChange }) {
    return (
        <div className="card shadow mb-4">
            <div className="card-body">
                <h4 className="card-title">Enter Contact Information</h4>
                <Field id="firstName" label="First Name" placeholder="First Name"
                    value={values.firstName} error={errors.firstName}
                    onChange={v => onChange('firstName', v)} />
                <Field id="lastName" label="Last Name" placeholder="Last Name"
                    value={values.lastName} error={errors.lastName}
                    onChange={v => onChange('lastName', v)} />
                <Field id="inputEmail" label="Email" type="email" placeholder="Email Address"
                    value={values.email} error={errors.email}
                    onChange={v => onChange('email', v)} />
                <Field id="inputPhone" label="Phone #" type="tel" placeholder="Phone #"
                    value={values.phone} error={errors.phone}
                    onChange={v => onChange('phone', v)} />
                <Field id="inputComments" label="Details" error={errors.comments}
                    onChange={v => onChange('comments', v)}>
                    <textarea
                        id="inputComments"
                        className="form-control"
                        placeholder="Please include building floor, suite/room number, specific problem location, and a detailed problem description"
                        value={values.comments}
                        onChange={e => onChange('comments', e.target.value)}
                    />
                </Field>
            </div>
        </div>
    );
}

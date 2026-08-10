export default function Footer() {
    return (
        <footer className="bs-footer" role="contentinfo">
            <div className="container">
                <div className="row align-items-center">
                    <div className="col-lg-2">
                        <img
                            alt="Official City of Raleigh Seal"
                            className="logo"
                            src={`${import.meta.env.BASE_URL}img/City-Seal-BW.png`}
                        />
                    </div>
                    <div className="col-lg-8">
                        <p>
                            Designed and developed by the City of Raleigh{' '}
                            <a
                                href="https://raleighnc.gov/departments/information-technology/geographic-information-services-gis"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Geographic Information Services (GIS)
                            </a>{' '}
                            division &copy;2013
                        </p>
                        <p>Developed for the City of Raleigh Facilities &amp; Operations division, 919-996-3420</p>
                    </div>
                    <div className="col-lg-2">
                        <img
                            src={`${import.meta.env.BASE_URL}img/PRCR - White.png`}
                            alt="Parks, Recreation and Cultural Resources"
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
}

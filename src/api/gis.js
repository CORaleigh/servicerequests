const BUILDINGS = 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/FACILITIES/MapServer/1/query';
const DISTRICTS = 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/PARKS/MapServer/28/query';

// Web Mercator, the projection Cityworks stores coordinates in. ESRI's code for
// it; EPSG calls the same thing 3857 and the server accepts either.
//
// Pinned rather than inherited: these layers are published in NC State Plane
// (102719 / EPSG 2264) today, and a query with no outSR returns whatever the
// layer happens to be in. That is how service requests came to be created with
// State Plane coordinates in a Cityworks that expects Web Mercator — the layer
// was republished and the app followed it silently. Asking for an explicit
// projection makes the app immune to the layer changing again.
const WEB_MERCATOR = 102100;

async function esriGet(url, params) {
    const res = await fetch(`${url}?${new URLSearchParams({
        f: 'json',
        outSR: WEB_MERCATOR,
        ...params,
    })}`);
    return res.json();
}

export async function fetchFacilities() {
    const data = await esriGet(BUILDINGS, {
        where: "WEBFORM = 'Y'",
        returnGeometry: false,
        outFields: 'LOCATION,LEGACYID',
        returnDistinctValues: true,
        orderByFields: 'LOCATION',
    });
    return data.features ?? [];
}

export async function fetchFacilityData(location) {
    const data = await esriGet(BUILDINGS, {
        where: `LOCATION = '${location.replace(/'/g, "''")}'`,
        outFields: '*',
        returnGeometry: true,
    });
    return data.features ?? [];
}

export async function fetchDistrict(x, y, fieldName) {
    const data = await esriGet(DISTRICTS, {
        geometryType: 'esriGeometryPoint',
        geometry: `${x},${y}`,
        // The point being tested is Web Mercator (it came from fetchFacilityData),
        // but this layer is published in State Plane. Without inSR the server
        // reads the point as State Plane, it lands nowhere near the districts,
        // and the lookup returns no match — leaving SubmitTo unset and the
        // request unrouted. Declaring it lets the server project before testing.
        inSR: WEB_MERCATOR,
        returnGeometry: false,
        outFields: fieldName,
    });
    return data.features ?? [];
}

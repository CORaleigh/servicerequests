const BUILDINGS = 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/FACILITIES/MapServer/1/query';
const DISTRICTS = 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/PARKS/MapServer/28/query';

async function esriGet(url, params) {
    const res = await fetch(`${url}?${new URLSearchParams({ f: 'json', ...params })}`);
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
        returnGeometry: false,
        outFields: fieldName,
    });
    return data.features ?? [];
}

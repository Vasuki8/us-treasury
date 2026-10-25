export const BLS_API_V1='https://api.bls.gov/publicAPI/v1/timeseries/data/';
export const BLS_API_V2='https://api.bls.gov/publicAPI/v2/timeseries/data/';

export const matchesBlsApiFeed=value=>value===BLS_API_V1||value===BLS_API_V2;

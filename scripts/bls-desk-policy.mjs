import {BLS_DESK_API,BLS_DESK_TERMS,blsDeskDefinitions} from '../src/bls-desk-definitions.js';
import {validateBlsDeskSource} from '../src/bls-desk-schema.js';
import {isEmptyFailedSource} from './empty-source-attempt.mjs';
export const blsDeskPolicy={id:'bls-specialist-desk',agency:'blsDesk',reviewedOn:'2026-11-01',commercialUse:true,basis:'Official public-domain BLS CES/CPS/ECI/PRS current revised observations with retained exact source codes, reference periods, native units, source attribution, calculation distinctions and actual hashed retrieval receipts; no original-release timing inferred.',terms:BLS_DESK_TERMS,feed:'bls-desk-api',series:Object.fromEntries(Object.entries(blsDeskDefinitions).map(([id,item])=>[id,[...item.sourceIds]]))};
export const blsDeskPolicies=[blsDeskPolicy];
export const matchesBlsDeskFeed=value=>value===BLS_DESK_API;
export function assertBlsDeskSource(source){if(!validateBlsDeskSource(source))throw new Error('Invalid or unreviewed BLS desk source scope, measurement or capture lineage');return source;}
export function assertBlsDeskData(snapshot){if(snapshot.sources?.blsDesk&&!isEmptyFailedSource(snapshot.sources.blsDesk,'blsDesk'))assertBlsDeskSource(snapshot.sources.blsDesk);}

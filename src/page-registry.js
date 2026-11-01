/** Registered page types; the indicator path receives an encoded series ID. */
import {stitchDeskContracts} from './stitch-desk-contracts.js';
export const pagePaths={
  ...Object.fromEntries(Object.entries(stitchDeskContracts).map(([id,d])=>[id,d.path])),
  release:'/release',credit:'/credit',research:'/research',sources:'/sources',macroCoverage:'/economy',overview:'/overview',
  labor:'/economy/labor',indicator:'/series/',calendar:'/calendar',explore:'/explore',watchlist:'/watchlist',fiscal:'/fiscal',
  refinancing:'/refinancing',yields:'/yields',auctions:'/auctions',ownership:'/ownership',macro:'/macro',vintages:'/vintages',
  market:'/market',
};

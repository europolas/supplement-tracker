/** Preserved 0.12.6 pipeline, isolated from HTTP composition for provider experiments.
 * This is a factory, not a startup action: importing it never sends a request.
 * TrackerApi still owns xAI credential storage and result persistence. A Jev
 * Choice is NOT a drop-in replacement for a sourced research response.
 */
import {createStructuredResearch,createStructuredOutput} from '../structured-research.mjs';
import {createPhotoInventoryDiscovery} from '../photo-inventory.mjs';
export function createGrokPipeline({models=['grok-4.7']}={}) {
 return {
  chat:createStructuredResearch(),
  review:createStructuredResearch({timeout:180000,maxTurns:4,reasoningEffort:'low',parallelToolCalls:true}),
  discover:createPhotoInventoryDiscovery(createStructuredOutput({timeout:90000,reasoningEffort:'low'})),
  discoveryModel:'grok-4.7',models
 };
}

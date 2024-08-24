import { Model } from '@edvoapp/common';
import { PropertyNode } from './base';

/**
 * We will want to eventually show that Alice previously shared with Bob
 * Other properties have their privileges updated on the basis of their Nodes
 * This subclass exists to expressly NOT update the share instruction property privileges
 * Their privilges are fixed at creation, and should not be updated through the viewModel
 */
export class ShareInstruction extends PropertyNode {}

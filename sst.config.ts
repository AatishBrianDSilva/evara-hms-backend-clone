import { SSTConfig } from 'sst';
import { MainStack } from './stacks/MainStack';
import { PharmacyApiStack } from './stacks/PharmacyApiStack';
import { MastersApiStack } from './stacks/MastersApiStack';
import { MastersApiLocalStack } from './stacks/MastersApiLocalStack';
import { PatientJourneyStack } from './stacks/PatientJourneyStack';

export default {
  config(_input) {
    return {
      name: 'hms-backend',
      region: 'ap-south-1',
      profile: 'evara-prod',
    };
  },
  stacks(app) {
    if (app.stage !== 'prod') {
      app.setDefaultRemovalPolicy('destroy');
    }
    app
      .stack(MainStack)
      .stack(PatientJourneyStack)
      .stack(PharmacyApiStack)
      .stack(MastersApiStack)
      .stack(MastersApiLocalStack);
  },
} satisfies SSTConfig;

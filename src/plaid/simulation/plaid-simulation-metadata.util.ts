import { type ConfigService } from '@nestjs/config';
import { type StructuredValue } from '@slatrap/slatrap';

export function withPlaidSimulationMetadata(
  payload: Record<string, StructuredValue>,
  configService: ConfigService,
): StructuredValue {
  return {
    ...payload,
    itemId: configService.get<string>('SIMULATION_ITEM_ID') ?? null,
    institutionId: configService.get<string>('SIMULATION_INSTITUTION_ID') ?? null,
    institutionName:
      configService.get<string>('SIMULATION_INSTITUTION_NAME') ?? null,
  };
}

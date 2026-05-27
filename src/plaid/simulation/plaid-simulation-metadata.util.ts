import { type ConfigService } from '@nestjs/config';

export function withPlaidSimulationMetadata(
  payload: object,
  configService: ConfigService,
): Record<string, unknown> {
  return {
    ...payload,
    itemId: configService.get<string>('SIMULATION_ITEM_ID'),
    institutionId: configService.get<string>('SIMULATION_INSTITUTION_ID'),
    institutionName: configService.get<string>('SIMULATION_INSTITUTION_NAME'),
  };
}

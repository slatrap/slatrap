import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ItemMetadata {
  itemId: string;
  institutionId: string;
  institutionName?: string;
}

@Injectable()
export class ItemMetadataService {
  constructor(private readonly prismaService: PrismaService) {}

  async resolve(errorContext: {
    itemId?: string;
    institutionId?: string;
    institutionName?: string;
  }): Promise<ItemMetadata> {
    const itemId = errorContext.itemId;
    let institutionId = errorContext.institutionId;
    let institutionName = errorContext.institutionName;

    if (!itemId) {
      return {
        itemId: 'unknown',
        institutionId: institutionId ?? 'unknown',
        institutionName,
      };
    }

    if (!this.prismaService.isEnabled) {
      return {
        itemId,
        institutionId: institutionId ?? 'unknown',
        institutionName,
      };
    }

    let savedItem = null as
      | (Awaited<
          ReturnType<typeof this.prismaService.db.item.findUnique>
        > & {})
      | null;
    savedItem = await this.prismaService.db.item.findUnique({
      where: { itemId },
    });

    if (savedItem) {
      if (!institutionId) {
        institutionId = savedItem.institutionId;
      }
      if (!institutionName) {
        institutionName = savedItem.institutionName ?? undefined;
      }
    }

    if (!savedItem && institutionId) {
      await this.prismaService.db.item.create({
        data: { itemId, institutionId, institutionName },
      });
    } else if (
      savedItem &&
      ((institutionId && institutionId !== savedItem.institutionId) ||
        institutionName !== savedItem.institutionName)
    ) {
      await this.prismaService.db.item.update({
        where: { itemId },
        data: { institutionId, institutionName },
      });
    }

    return {
      itemId,
      institutionId: institutionId ?? 'unknown',
      institutionName,
    };
  }
}

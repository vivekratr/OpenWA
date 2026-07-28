import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MinLength, ValidateNested, ArrayMinSize } from 'class-validator';

class SavedContactItemDto {
  @ApiProperty({ example: '919820229230' })
  @IsString()
  @MinLength(10)
  phone: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class UpsertSavedContactsDto {
  @ApiProperty({ type: [SavedContactItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SavedContactItemDto)
  contacts: SavedContactItemDto[];
}

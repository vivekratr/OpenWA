import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartMobileAuthDto {
  @ApiProperty({ example: '919876543210', description: 'Phone number with country code, digits only' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8,15}$/, { message: 'phoneNumber must be 8-15 digits with country code' })
  phoneNumber: string;
}
